import prisma from "../prismacl.js";

import { Router } from "express";

const router = Router()

router.get('/list', async (req, res) => {
    const regions = await prisma.region.findMany();
    res.json(regions)
})

export default router