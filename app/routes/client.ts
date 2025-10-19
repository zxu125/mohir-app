import prisma from "../prismacl.js";

import { Router } from "express";

const router = Router();

// Create a new client
router.post('/add', async (req, res) => {
  const { name, email, phone, regionId } = req.body;
  console.log('Creating client with data:', req.body);
  try {
    await prisma.$transaction(async (prisma) => {
      const client = await prisma.client.create({
        data: {
          name, email, phone, regionId
        },
        include: {
          locations: { include: { location: true } },
        },
      });

      let locations = req.body.locations.map((loc: any) => ({
        latitude: loc.latitude,
        longitude: loc.longitude
      }));
      locations = await Promise.all(
        locations.map((loc: any) => (prisma.location.create({ data: loc })))
      );

      let clientlocations = await prisma.clientLocation.createMany({
        data: locations.map((loc: any) => ({
          clientId: client.id,
          locationId: loc.id
        }))
      });

      if (locations.length) {
        const stocks = await prisma.stock.createMany({
          data: locations.map((loc: any) => ({
            clientId: client.id,
            locationId: loc.id,
            quantity: 0,
            productId: 1 // default product
          }))
        });
      }

      res.status(201).json(client);
    })
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error });
  }
});

// Get a client by ID
router.get('/view/:id', async (req, res) => {
  try {
    const client: any = await prisma.client.findUnique({
      where: { id: Number(req.params.id) },
      select: { region: true, id: true, name: true, phone: true, email: true, locations: { select: { location: true } } }
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    client.location = client.locations[0]?.location
    client.locations = undefined
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve client' });
  }
});

// Update a client by ID
router.post('/edit', async (req, res) => {
  const { name, email, phone, regionId } = req.body;
  try {
    let client: any = await prisma.client.update({
      where: { id: Number(req.body.id) },
      data: { name, email, phone, regionId },
      include: { locations: true }
    });
    if (req.body.location) {
      await prisma.location.update({
        where: {
          id: client.locations[0].clientId,
        },
        data: { latitude: req.body.location.latitude, longitude: req.body.location.longitude }
      })
    }
    client = await prisma.client.findUnique({ where: { id: client.id }, include: { locations: true, region: true } })
    client.location = client.locations[0]
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.get('/list', async (req, res) => {
  const params = req.query;
  let fileds = params.flds ? String(params.flds).split(',') : ['id', 'name', 'email', 'phone', 'locations', 'region'];
  console.log('Listing clients with params:', params);
  try {
    let clients = await prisma.client.findMany({
      where: {
        name: params.name ? String(params.name) : undefined,
        email: params.email ? String(params.email) : undefined,
        phone: params.phone ? String(params.phone) : undefined,
      },
      select: {
        id: fileds.includes('id'),
        name: fileds.includes('name'),
        email: fileds.includes('email'),
        phone: fileds.includes('phone'),
        region: fileds.includes('region')
      },
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve clients' + error });
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