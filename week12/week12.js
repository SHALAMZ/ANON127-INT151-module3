// console.log('starting... ');
// console.log('working... ');
// console.log('ending...');


// console.log('starting... ');
// setTimeout(()=>console.log('working...'),3000)
// console.log('ending...');


function doSomething(hasResource) {
    return new Promise((resolve,reject)=>{
        setTimeout(()=>(hasResource ? resolve("done") : reject("fail")),5000)
    })
}

// 2. async-await
async function working2() {
    console.log('starting...');
    try{
        const workStatus = await doSomething(false)
        console.log(workStatus);
        console.log('ending...'); 
    } catch (error){
        console.log(error);
        
    }
    
    
}

working2()


// test
// console.log('starting... ');

// doSomething(false).then((result)=>{
//     console.log('working... ')
//     console.log(`work status = ${result}`)
//     console.log('ending...');
    
// }).catch((error)=>{
//     console.error('error จ้าาาา');
// })

// console.log('ending...');