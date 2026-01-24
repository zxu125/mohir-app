import prisma from "../prismacl.js";

import { Router } from "express";

const router = Router();

// Create a new client
router.post('/add', async (req, res) => {
  const { name, email, phone, phone2, regionId, address, deliveryNote, locations } = req.body;
  console.log('Create client request body:', req.body);
  if(!name || !locations || locations.length == 0) {
    return res.status(400).json({ error: 'Необходимы имя и регион клиента' });
  }
  try {
    const existing = await prisma.client.findFirst({
      where: { name }
    });
    if (existing) {
      return res.status(400).json({ error: 'Клиент с таким ИД существует' });
    }
    await prisma.$transaction(async (prisma) => {
      const client = await prisma.client.create({
        data: {
          name, email, phone, phone2, regionId, address, deliveryNote
        },
        include: {
          locations: { include: { location: true } },
        },
      });
      let locations = req.body.locations.map((loc: any) => ({
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude)
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
            productId: 1
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
router.get('/view', async (req: any, res) => {
  try {
    const client: any = await prisma.client.findUnique({
      where: {
        id: Number(req.query.id),
        regionId: req.user.role.id == 1 ? undefined : { in: req.user.regions.map((e: any) => e.id) }
      },
      include: { locations: { include: { location: true } } }
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    client.location = client.locations[0]?.location
    client.locations = undefined
    client.order = (await prisma.order.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 1,
    }))[0]
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve client' });
  }
});

// Update a client by ID
router.post('/edit', async (req, res) => {
  const { name, email, phone, phone2, regionId, address, deliveryNote } = req.body;
  console.log('Edit client request body:', req.body);
  try {
    let client: any = await prisma.client.update({
      where: { id: Number(req.body.id) },
      data: { name, email, phone, phone2, regionId, address, deliveryNote },
      include: { locations: true }
    });
    if (req.body.location) {
      await prisma.location.update({
        where: {
          id: client.locations[0].locationId,
        },
        data: { latitude: req.body.location.latitude, longitude: req.body.location.longitude }
      })
    }
    client = await prisma.client.findUnique({ where: { id: client.id }, include: { locations: { include: { location: true } }, region: true } })
    client.location = client.locations[0].location
    console.log(client);
    res.json(client);
  } catch (error) {
    res.status(500).json({ error });
  }
});

router.get('/list', async (req: any, res) => {
  const params = req.query;
  let fileds = params.flds ? String(params.flds).split(',') : ['id', 'name', 'email', 'phone', 'location', 'region', 'address', 'deliveryNote'];
  console.log('Listing clients with params:', params);
  try {
    let clients: any = await prisma.client.findMany({
      where: {
        name: params.name ? String(params.name) : undefined,
        email: params.email ? String(params.email) : undefined,
        phone: params.phone ? String(params.phone) : undefined,
        AND: [
          params.regionId ? { regionId: Number(params.regionId) } : {},
          req.user.role.id == 1 ? {} : { regionId: { in: req.user.regions.map(e => e.id) } }
        ]
      },
      select: {
        id: fileds.includes('id'),
        name: fileds.includes('name'),
        email: fileds.includes('email'),
        phone: fileds.includes('phone'),
        region: fileds.includes('region'),
        deliveryNote: fileds.includes('deliveryNote'),
        address: fileds.includes('address'),
        locations: fileds.includes('location') ? { include: { location: true } } : false,
      },
    });
    clients = clients.map((client: any) => {
      if (client.locations && client.locations.length) {
        client.location = client.locations[0].location;
      }
      client.locations = undefined;
      return client;
    });
    res.json(clients);
  } catch (error) {
    console.log(error)
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
