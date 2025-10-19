import { Expo } from "expo-server-sdk";

const expo = new Expo();

await expo.sendPushNotificationsAsync([
  {
    to: "ExponentPushToken[XXXXXXXXXXXXXX]",
    sound: "default",
    title: "Тест push",
    body: "Это пуш-уведомление через Node",
  },
]);
