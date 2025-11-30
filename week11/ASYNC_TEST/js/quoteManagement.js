import { getItems } from "./myLib/fetchUtils";
async function loadQoutes() {
    try{
        const quotes = await getItems(`${import.meta.env.VITE_APP_URL}/quotes`)
        return quotes
    }catch(e){
        alert(e)
    }
}
export {loadQoutes}
