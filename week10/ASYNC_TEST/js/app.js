import { loadQoutes } from "./quoteManagement";
document.addEventListener('DOMCOntentLoaded',async()=>{
    const quotes = await loadQoutes()
    console.log(quotes)
})