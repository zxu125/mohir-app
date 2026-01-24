import { WebSocketServer } from "ws";
import prisma from "../prismacl.js";

export function InitWebSocket(port) {

    const wss = new WebSocketServer({ port });

    wss.on("connection", (ws) => {
        ws.on("message", async (message) => {
            const data = JSON.parse(message.toString());
            try {
                if (data.type == "driver_location") {
                    const { driverId, lat, lng, ts } = data;
                    // Обновляем БД
                    await prisma.courier.update({
                        where: { id: Number(driverId) },
                        data: {
                            lastLat: lat,
                            lastLng: lng,
                            lastUpdate: new Date(ts),
                        },
                    });
                    // Разослать всем подписчикам (например, диспетчеру)
                    wss.clients.forEach((client) => {
                        client.send(JSON.stringify({
                            type: "driver_location_update",
                            driverId, lat, lng, ts
                        }));
                    });
                }
            } catch (error) {
                console.error("Error processing WS message:", error);
            }
        });
    });
    return wss;
}
