
const Admin = {
    id: 1,
    name: 'Admin',
    key: 'admin',
    description: 'Administrator with full access',
}

const Kourier = { 
    id: 2,
    name: 'Kourier',
    key: 'kourier',
    description: 'Kourier with limited access',
    actions: {
        canCreateOrder: true,
        canUpdateOrderStatus: true,
        canViewOrders: true,
        canManageUsers: false,
    },
    routes:{
        'orders':['list', 'view', 'complete-order'],
        'map':['all']
    }
}

export default [Admin, Kourier];