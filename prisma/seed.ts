// import { PrismaClient, Role } from '@prisma/client'

// const prisma = new PrismaClient()

// async function main() {
//   const user1 = await prisma.user.create({
//     data: {
//       name: 'Alice',
//       email: 'alice@example.com',
//       role: Role.employee,
//       payroll: {
//         create: {
//           hourlyRate: 20.0
//         }
//       }
//     },
//     include: {
//       payroll: true
//     }
//   })

//   const user2 = await prisma.user.create({
//     data: {
//       name: 'Bob',
//       email: 'bob@example.com',
//       role: Role.admin,
//       payroll: {
//         create: {
//           hourlyRate: 25.0
//         }
//       }
//     },
//     include: {
//       payroll: true
//     }
//   })

//   const event1 = await prisma.event.create({
//     data: {
//       name: 'Meeting',
//       duration: 60,
//       startTime: new Date(),
//       endTime: new Date(),
//       attendees: {
//         create: [
//           { 
//             user: {
//               connect: { id: user1.id }
//             }
//           },
//           { 
//             user: {
//               connect: { id: user2.id }
//             }
//           },
//         ],
//       },
//     },
//     include: {
//       attendees: {
//         include: {
//           user: true,
//         },
//       },
//     },
//   })
  
//   console.log(event1)
// }

// main()
//   .catch(e => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prisma.$disconnect()
//   })
