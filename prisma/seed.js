const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const adapter = new PrismaBetterSqlite3({
  url: 'file:' + path.resolve(__dirname, 'dev.db')
});
const prisma = new PrismaClient({ adapter });

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'salt-aems', 1000, 64, 'sha512').toString('hex');
}

async function main() {
  console.log('Seeding database...');

  // 1. Create Clients
  const clientData = [
    { name: 'Shree Ashtvinayak Glass Pvt Ltd', pfApplicable: true, esicApplicable: true, ptApplicable: true },
    { name: 'Inled Technology LLP', pfApplicable: true, esicApplicable: true, ptApplicable: true },
    { name: 'TBK India Pvt Ltd', pfApplicable: true, esicApplicable: true, ptApplicable: true },
    { name: 'Infinity Switch Pvt Ltd', pfApplicable: true, esicApplicable: true, ptApplicable: true },
    { name: 'Sai Packing Industries', pfApplicable: true, esicApplicable: true, ptApplicable: true },
    { name: 'Arnav Enterprises', pfApplicable: false, esicApplicable: false, ptApplicable: true },
  ];

  const clients = [];
  for (const c of clientData) {
    const client = await prisma.client.upsert({
      where: { name: c.name },
      update: c,
      create: c,
    });
    clients.push(client);
    console.log(`Created client: ${client.name}`);
  }

  const ashtvinayak = clients.find(c => c.name.includes('Ashtvinayak'));
  const inled = clients.find(c => c.name.includes('Inled'));
  const arnav = clients.find(c => c.name.includes('Arnav'));

  // 2. Create Employee records for Arnav Enterprises
  const employeeData = [
    { name: 'Kishor Jadhav', phoneNo: 'kishor', gender: 'Male', salaryRate: 1000 },
    { name: 'Snehal Kabule', phoneNo: 'snehal', gender: 'Female', salaryRate: 800 },
    { name: 'Somnath Mohite', phoneNo: 'somnath', gender: 'Male', salaryRate: 900 },
    { name: 'Sandip Patole', phoneNo: 'sandip', gender: 'Male', salaryRate: 900 },
    { name: 'Payal Shelar', phoneNo: 'payal', gender: 'Female', salaryRate: 800 },
    { name: 'Akash Jagtap', phoneNo: 'akash', gender: 'Male', salaryRate: 700 },
    { name: 'Dipak Shinde', phoneNo: 'dipak', gender: 'Male', salaryRate: 700 },
  ];

  const employeeRecords = {};
  for (let i = 0; i < employeeData.length; i++) {
    const e = employeeData[i];
    const empCode = `AE${String(i + 1).padStart(3, '0')}`;
    const employee = await prisma.employee.upsert({
      where: { employeeCode: empCode },
      update: { name: e.name, phoneNo: e.phoneNo, gender: e.gender, salaryRate: e.salaryRate },
      create: {
        employeeCode: empCode,
        clientId: arnav.id,
        name: e.name,
        dob: '01-01-1990',
        address: 'Pune, Maharashtra',
        documentStatus: 'Verified',
        dateOfJoining: '01-01-2024',
        status: 'Active',
        gender: e.gender,
        phoneNo: e.phoneNo,
        salaryRate: e.salaryRate,
      },
    });
    employeeRecords[e.name] = employee.id;
    console.log(`Created employee: ${e.name} (${empCode})`);
  }

  // 3. Add multiple locations for Sandip Patole (supervisor working at 2 sites)
  const sandipId = employeeRecords['Sandip Patole'];
  if (sandipId) {
    // Delete any existing locations for Sandip first
    await prisma.employeeLocation.deleteMany({ where: { employeeId: sandipId } });

    await prisma.employeeLocation.createMany({
      data: [
        {
          employeeId: sandipId,
          locationName: 'Ashtvinayak 2',
          latitude: '18.5204',
          longitude: '73.8567',
          inTime: '09:00',
          outTime: '18:00',
          isDefault: true,
          sortOrder: 0,
        },
        {
          employeeId: sandipId,
          locationName: 'Infinity Site',
          latitude: '18.5300',
          longitude: '73.8400',
          inTime: '08:30',
          outTime: '17:30',
          isDefault: false,
          sortOrder: 1,
        },
      ],
    });
    console.log('Added 2 locations for Sandip Patole');
  }

  // 3. Create Users
  const userData = [
    { username: 'admin', passwordHash: hashPassword('admin123'), role: 'admin', assignedClientId: null },
    { username: 'accountant', passwordHash: hashPassword('accountant123'), role: 'accountant', assignedClientId: null },
    { username: 'snehal', passwordHash: hashPassword('snehal123'), role: 'accountant', assignedClientId: null },
    { username: 'payal', passwordHash: hashPassword('payal123'), role: 'accountant', assignedClientId: null },
    { username: 'somnath', passwordHash: hashPassword('somnath123'), role: 'supervisor', assignedClientId: ashtvinayak ? ashtvinayak.id : null },
    { username: 'sandip', passwordHash: hashPassword('sandip123'), role: 'supervisor', assignedClientId: inled ? inled.id : null },
  ];

  // Map staff usernames to their full names in employeeRecords
  const userToFullName = {
    snehal: 'Snehal Kabule',
    payal: 'Payal Shelar',
    somnath: 'Somnath Mohite',
    sandip: 'Sandip Patole',
  };

  for (const u of userData) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: u,
      create: u,
    });

    // Link employee record to matching staff user
    const fullName = userToFullName[u.username];
    if (fullName) {
      const empId = employeeRecords[fullName];
      if (empId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { employeeId: empId },
        });
        console.log(`Linked ${u.username} -> ${fullName} (${empId})`);
      }
    }

    // Sync client links for supervisors
    if (u.role === 'supervisor') {
      const linkIds = [];
      if (u.username === 'sandip') {
        if (inled) linkIds.push(inled.id);
        if (arnav) linkIds.push(arnav.id);
      } else if (ashtvinayak) {
        linkIds.push(ashtvinayak.id);
      }
      await prisma.userClient.deleteMany({ where: { userId: user.id } });
      if (linkIds.length) {
        await prisma.userClient.createMany({
          data: linkIds.map((cid) => ({ userId: user.id, clientId: cid })),
        });
      }
    } else {
      await prisma.userClient.deleteMany({ where: { userId: user.id } });
    }

    console.log(`Created user: ${u.username} (${u.role})`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
