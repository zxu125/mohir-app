import { Router } from "express";
import { z } from "zod";
import { sendPushToUser } from "../helpers/expoPush";

const router = Router();

const sendToUserSchema = z.object({
    userId: z.number().int().positive(),
    title: z.string().max(200).optional(),
    body: z.string().min(1).max(2000),
    data: z.any().optional(),
});

// 1) отправка пуша любому userId (закрой авторизацией: admin/role)
router.post("/send-to-user", async (req, res) => {
    const parsed = sendToUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid body", issues: parsed.error.issues });
    }

    // TODO: тут проверка, что текущий пользователь админ
    const out = await sendPushToUser(parsed.data);
    return res.json(out);
});

// 2) тест: отправить пуш “мне”
router.post("/send-test-to-me", async (req, res) => {
    const userId = (req as any).user.id as number;
    const body = typeof req.body?.body === "string" ? req.body.body : "Test push";
    const title = typeof req.body?.title === "string" ? req.body.title : "Test";

    const out = await sendPushToUser({ userId, title, body, data: req.body?.data ?? {} });
    return res.json(out);
});

export default router;
