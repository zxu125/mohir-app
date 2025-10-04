import prisma from "../prismacl.js";

import { Router } from "express";

const router = Router();

type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
};
type Location = {
  address: string;
  latitude: number;
  longtitude: number;
}

// Create a new client
router.post('/add', async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const client = await prisma.client.create({
      data: {
        name, email, phone
      },
      include: {
        locations: { include: { location: true } },
      },
    });

    let locations = req.body.locations
    console.log(locations);
    locations = await Promise.all(
      locations.map((loc: any) => (prisma.location.create({ data: loc })))
    );
    console.log(locations);

    let clientlocations = await prisma.clientLocation.createMany({
      data: locations.map((loc: any) => ({
        clientId: client.id,
        locationId: loc.id
      }))
    });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error });
  }
});

// Get a client by ID
router.get('/view/:id', async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve client' });
  }
});

// Update a client by ID
router.post('/edit', async (req, res) => {
  try {
    const client = await prisma.client.update({
      where: { id: Number(req.body.id) },
      data: req.body,
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.get('/list', async (req, res) => {
  const params = req.query;
  try {
    const clients = await prisma.client.findMany({
      where: {
        name: params.name ? String(params.name) : undefined,
        email: params.email ? String(params.email) : undefined,
        phone: params.phone ? String(params.phone) : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        locations: {
          select: {
            location: true,
          },
        },
      },
    });
    const result = clients.map(c => ({
      ...c,
      locations: c.locations.map(l => l.location), // flatten
    }))
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve clients'+ error });
  }
});

// Delete a client by ID
router.post('/delete/:id', async (req, res) => {
  try {
    const client = await prisma.client.delete({
      where: { id: Number(req.params.id) },
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;