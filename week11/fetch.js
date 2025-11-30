//Synchronous ทำงานแบบไม่รอ ทำไปเลย
console.log("starting..")
console.log('working...')
console.log('ending...')
//Asynchronous ทำงานแบบรอ
console.log("starting..")
setTimeout(() =>console.log('working...'),5000)
console.log('ending...')
// console.log('hello')
// setTimeout(() => console.log('world, '), 3000) //รอ3วิ ข้ามคำสั่งไปbyeก่อน
// console.log('bye') 
const promise = new Promise(function(resolve,reject){})

function doSomething(hasResource){
    return new Promise((resolve,reject)=>{
        setTimeout(()=>(hasResource?resolve("done"):reject("fail")),5000)
    })
}
console.log("starting..")
// console.log(doSomething(false))
const workStatus = doSomething(true)
console.log(workStatus)
console.log('ending...')

//handle promise -2 way 1 .then().catch() 2.async-await()
//1
console.log('stating')
doSomething(true).then((result)=>{
    console.log('working')
    console.log(`working status ${result}`)
    console.log('ending')
}).catch((error)=>{
    console.log(error)
})
// 2
async function working2() {
    console.log('starting..')
    try{
        const workingStatus = await doSomething(true)
    }
    catch (error){
        console.log(error)
    }
}
