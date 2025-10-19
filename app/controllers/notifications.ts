import { Expo } from "expo-server-sdk";
import prisma from "../prismacl.js";

const expo = new Expo();

// Отправка уведомления пользователю по userId
export async function sendPush(userId: number, title: string, body: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.pushToken) return;

  if (!Expo.isExpoPushToken(user.pushToken)) {
    console.log("❌ Invalid Expo push token:", user.pushToken);
    return;
  }

  const message = {
    to: user.pushToken,
    sound: "default",
    title,
    body,
    data: { userId },
  };

  await expo.sendPushNotificationsAsync([message]);
}
await sendPush(1, "Новый заказ", "У вас есть новый заказ от клиента!");
