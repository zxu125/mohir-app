import { Expo, ExpoPushTicket } from "expo-server-sdk";
import { PrismaClient, PushTokenStatus, DeliveryStatus } from "@prisma/client";

const prisma = new PrismaClient();
const expo = new Expo();

type PushMessageInput = {
    userId: number;
    title?: string;
    body: string;
    data?: any;
};

// Вспомогательное: unix ms как BigInt
const nowMs = () => BigInt(Date.now());

export async function sendPushToUser(input: PushMessageInput) {
    const { userId, title, body, data = {} } = input;

    // 1) берём активные девайсы пользователя (есть активная refresh session) + активный push token
    const rows = await prisma.refreshTokens.findMany({
        where: {
            userId,
            revoked: false,
            expiresAt: { gt: nowMs() },
        },
        select: {
            deviceId: true,
            device: {
                select: {
                    pushTokens: {
                        where: { status: PushTokenStatus.active },
                        orderBy: { updatedAt: "desc" },
                        take: 1,
                        select: { id: true, expoToken: true },
                    },
                },
            },
        },
    });

    const targets = rows
        .map((r) => ({
            deviceId: r.deviceId,
            pushToken: r.device.pushTokens[0], // может быть undefined
        }))
        .filter((x) => x.pushToken && Expo.isExpoPushToken(x.pushToken.expoToken));

    if (targets.length === 0) {
        return { ok: true, sent: 0, reason: "no_active_devices_or_tokens" };
    }

    // 2) создаём запись notifications (outbox)
    const notification = await prisma.notification.create({
        data: {
            userId,
            title: title ?? null,
            body,
            data,
        },
        select: { id: true },
    });

    // 3) создаём deliveries по каждому девайсу
    const deliveries = await prisma.notificationDelivery.createMany({
        data: targets.map((t) => ({
            notificationId: notification.id,
            deviceId: t.deviceId,
            pushTokenId: t.pushToken!.id,
            status: DeliveryStatus.pending,
        })),
    });

    // 4) готовим сообщения
    const messages = targets.map((t) => ({
        to: t.pushToken!.expoToken,
        sound: "default" as const,
        title,
        body,
        data: { ...data, notificationId: notification.id },
    }));

    // 5) отправка чанками
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
    }

    // 6) сопоставим ticket -> delivery по порядку (Expo возвращает tickets в том же порядке, что и messages)
    // сохраняем ticketId и ставим status=sent, если ticket ok
    const deliveryRows = await prisma.notificationDelivery.findMany({
        where: { notificationId: notification.id },
        orderBy: { id: "asc" },
        select: { id: true, pushTokenId: true },
    });

    // Подстрахуемся: длины должны совпадать, но лучше обработать минимально
    const n = Math.min(tickets.length, deliveryRows.length);

    for (let i = 0; i < n; i++) {
        const ticket = tickets[i];
        const del = deliveryRows[i];

        if (ticket.status === "ok") {
            await prisma.notificationDelivery.update({
                where: { id: del.id },
                data: {
                    status: DeliveryStatus.sent,
                    expoTicketId: ticket.id ?? null,
                },
            });
        } else {
            await prisma.notificationDelivery.update({
                where: { id: del.id },
                data: {
                    status: DeliveryStatus.failed,
                    errorCode: ticket.details?.error ?? "ticket_error",
                    errorMessage: ticket.message ?? null,
                },
            });
        }
    }

    // 7) receipts (можно вынести в cron/worker; тут сделаем сразу)
    const receiptIds = tickets
        .map((t) => (t.status === "ok" ? t.id : null))
        .filter(Boolean) as string[];

    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

    for (const receiptChunk of receiptIdChunks) {
        const receipts = await expo.getPushNotificationReceiptsAsync(receiptChunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
            // найдём delivery по ticket id
            const delivery = await prisma.notificationDelivery.findFirst({
                where: { expoTicketId: receiptId },
                select: { id: true, pushTokenId: true },
            });

            if (!delivery) continue;

            if (receipt.status === "ok") {
                await prisma.notificationDelivery.update({
                    where: { id: delivery.id },
                    data: { status: DeliveryStatus.delivered, expoReceiptId: receiptId },
                });
            } else {
                const code = receipt.details?.error ?? "receipt_error";
                await prisma.notificationDelivery.update({
                    where: { id: delivery.id },
                    data: {
                        status: DeliveryStatus.failed,
                        expoReceiptId: receiptId,
                        errorCode: code,
                        errorMessage: receipt.message ?? null,
                    },
                });

                // Если девайс “отписан” — отключаем токен
                if (code === "DeviceNotRegistered") {
                    await prisma.pushToken.update({
                        where: { id: delivery.pushTokenId },
                        data: {
                            status: PushTokenStatus.disabled,
                            disabledAt: new Date(),
                            disableReason: "DeviceNotRegistered",
                        },
                    });
                }
            }
        }
    }

    return { ok: true, sent: targets.length, notificationId: notification.id };
}
