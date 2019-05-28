import * as mysql from "mysql2/promise";

interface ISettings {
    host: string,
    user: string,
    password: string,
    database: string,
    connectionLimit?: number,
    queueLimit?: number
}

export class DbHelper{
    settings: ISettings = {
        host: 'localhost',
        user: 'root',
        password: 'ROOT3322',
        database: 'sakila',
    }

    poolSettings: ISettings = {
        host: 'localhost',
        user: 'root',
        password: 'ROOT3322',
        database: 'sakila',
        connectionLimit: 10, 
        queueLimit: 0
    }

    pool: any = undefined;
    connection: any = undefined;

    // Store data
    storeSelect: string[] = [];
    storeTableName: string;
    storeJoin: string[] = [];
    storeWhere: string[] = [];
    storeGroupBy: string[] = [];
    storeHaving: string[] = [];
    storeOrderBy: string[] = [];
    storeLimit: number = 0;

    storeWhereData: any[] = [];
    storeHavingData: any[] = [];

    query: string;
    data: any[] = [];

    constructor(pool?: any) {

        return this;
    }

    private setPool = async () => {
        if(this.isEmpty(this.pool)){
            this.pool = await mysql.createPool(this.poolSettings);
        }
    }

    getPool = async () => {
        if(this.isEmpty(this.pool)){
            await this.setPool();
        }

        return this.pool;
    }

    private setConnection = async () => {
        if(this.isEmpty(this.connection)){
            this.connection = await mysql.createConnection(this.settings);
        }
    }

    getConnection = async () => {
        if(this.isEmpty(this.connection)){
            await this.setConnection();
        }

        return this.connection;
    }

    // methods
    select = (...columnNames: string[]) => {
        for(const columnName of columnNames) {
            if(!this.isEmpty(columnName)){
                this.storeSelect.push(this.addBackticksAroundColumnNames(columnName))
            }
        }

        return this;
    }

    from = (tableName:string) => {
        this.storeTableName = "`" + tableName + "`";

        return this;
    }

    join = (tableName: string, on: string, type: string = 'outer') => {
        let condition = on.split('=');

        condition = condition.map((value) => {
            value = value.trim();
            return this.addBackticksAroundColumnNames(value);
        })


        let joinStatement = type.toUpperCase() + " JOIN " + this.addBackticksAroundColumnNames(tableName) + " ON " + condition.join('=') + " ";
        this.storeJoin.push(joinStatement);

        return this;
    }

    whereDev = (columnName: string, data?: any, operator: string = '=') => {
        if(!this.isEmpty(data)){
            this.storeWhereData.push(data);
        }

        this.storeWhere.push(this.constructCondition(columnName,data,operator));

        return this;
    }

    where = (...condition: any[]) => {
        if (condition.length === 2){
            return this.whereDev(condition[0], condition[1]);
        }

        if (condition.length === 3) {
            return this.whereDev(condition[0], condition[2], condition[1]);
        }

        throw new Error("INCORRECT_FORMAT: Should be: where('age', 10) or where('age', '>', 10)");
    }

    whereIn = (columnName: string, data: any[]) => {
        return this.whereDev(columnName, data, 'IN');
    }
    
    whereNotIn = (columnName: string, data: any[]) => {
        return this.whereDev(columnName, data, 'NOT IN');
    }

    whereLike = (columnName: string, data: any[]) => {
        return this.whereDev(columnName, data, 'LIKE');
    }

    whereNotLike = (columnName: string, data: any[]) => {
        return this.whereDev(columnName, data, 'NOT LIKE');
    }

    whereNull = (columnName: string) => {
        return this.whereDev(columnName, undefined, 'IS NULL');
    }

    whereNotNull = (columnName: string) => {
        return this.whereDev(columnName, undefined, 'IS NOT NULL');
    }

    groupBy = (...columnNames:string[]) => {
        for(const columnName of columnNames) {
            if(!this.isEmpty(columnName)){
                this.storeGroupBy.push(this.addBackticksAroundColumnNames(columnName))
            }
        }

        return this;
    }

    orderBy = (columnName: string, type:string = "DESC") => {
        this.storeOrderBy.push(this.addBackticksAroundColumnNames(columnName)+ " " + type);

        return this;
    }

    limit = (limit:number) => {
        this.storeLimit = limit;

        return this;
    }

    having = (columnName: string, data: string | number, operator: string = '=') => {
        this.storeHavingData.push(data);

        this.storeHaving.push(this.constructCondition(columnName,data,operator));

        return this;
    }

    get = async (tableName?:string) => {
        this.buildSelect();

        const conn = await this.getConnection();

        return conn.execute(this.query, this.data, this.getResult);
    }

    closeConnection = () => {
        if (this.isEmpty(this.connection)) this.connection.end();
    }

    // Prepare helper functions
    private buildSelect = () => {
        if(this.isEmpty(this.storeTableName)){
            throw new Error("Please specify a table name.");
        }

        if(this.isEmpty(this.storeGroupBy) && !this.isEmpty(this.storeHaving)){
            throw new Error("The 'HAVING' clause is must have a 'GROUP BY' clause");
        }

        let queryString = `SELECT ${this.isEmpty(this.storeSelect) ? ' * ' : this.storeSelect.join(', ')} `;
        queryString += `FROM ${this.storeTableName} `;
        queryString += this.isEmpty(this.storeJoin) ? '' : this.storeJoin.join(' ');
        queryString += this.isEmpty(this.storeWhere) ? '' : "WHERE " + this.storeWhere.join(' AND ');
        queryString += this.isEmpty(this.storeGroupBy) ? '' : "GROUP BY " + this.storeGroupBy.join(', ');
        queryString += this.isEmpty(this.storeGroupBy) || this.isEmpty(this.storeHaving) ? '' : "HAVING " + this.storeHaving.join(' AND ');
        queryString += this.isEmpty(this.storeOrderBy) ? '' : "ORDER BY " + this.storeOrderBy.join(' AND ');
        queryString += this.isEmpty(this.storeLimit) ? '' : "LIMIT ? ";

        this.query = queryString;

        this.data = this.data.concat(this.storeWhereData).concat(this.storeHavingData);

        // If a limit is set put it in the data as well 
        if(!this.isEmpty(this.storeLimit)){
            this.data.push(this.storeLimit);
        }
    }

    // Helper functions
    private constructCondition = (columnName: string, data?: string | number, operator: string = '=') => {
        if(operator === 'IS NULL' || operator === 'IS NOT NULL'){
            return "`" + columnName + "` " + operator;
        }
        return "`" + columnName + "` " + operator + ' ? ';
    }

    private getResult = (err, rows) => {
        if(err) throw new Error('sup');

        return rows;
    }

    private addBackticksAroundColumnNames = (columnName: string) => {
        let tableNameColumnName = columnName.split('.');

        tableNameColumnName = tableNameColumnName.map((value) => {
            return "`" + value + "`";
        });

        return tableNameColumnName.join('.');
    }

    private isEmpty = (value:any) => {
        if (value === null || value === undefined || value === 0) return true;
        
        if (typeof value === 'string' && value.length < 1) return true;
        
        if (Array.isArray(value) && value.length < 1) return true; 

        if (Object.keys(value).length === 0 && value.constructor === Object) return true;

        return false;
    }
}