const today = new Date()
console.log(today)
const now = Date.now()
console.log(now)

const utcDate = new Date("2025-11-18T10:30:00z")
console.log(utcDate)
const localDate = new Date("2025-11-18T10:30:00")
console.log(localDate)

const myDate1 = new Date(2025,12,30,15,25)
console.log(myDate1)

const startBooking = new Date("2025-11-15T10:30:00z")
const startBooking2 = new Date("2025-11-15T10:30:00z")
const stopBooking = new Date("2025-11-16T10:30:00z")

console.log(startBooking.getTime())
console.log(stopBooking.getTime())
console.log(stopBooking === startBooking)
console.log(stopBooking.getTime() === startBooking.getTime())
console.log(startBooking2.getTime() === startBooking.getTime())
console.log(startBooking > stopBooking)
console.log(startBooking < stopBooking)