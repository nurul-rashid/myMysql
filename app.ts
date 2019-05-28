import { DbHelper } from "./db_helper";

let call = async () => {
    var db = new DbHelper();
    
    console.log(await db.select('actor_id', 'first_name', 'last_name').from('actor').limit(5).get());
}

call();