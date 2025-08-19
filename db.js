const { DBSQLClient } = require('@databricks/sql');

const databricksConnectOptions = {
    token: process.env.DATABRICKS_TOKEN,
    host: process.env.DATABRICKS_SERVER_HOSTNAME,
    path: process.env.DATABRICKS_HTTP_PATH
};

/**
 * Executes a query against Databricks.
 * Manages the full connection lifecycle: connect, execute, fetch, and close.
 * @param {string} statement The SQL statement to execute.
 * @param {Array<any>} [parameters=[]] An array of parameters for positional binding (using '?').
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of result objects.
 */
async function executeQuery(statement, parameters = []) {
    const client = new DBSQLClient();
    try {
        await client.connect(databricksConnectOptions);
        console.log("Databricks client connected.");

        const session = await client.openSession();
        console.log(`Executing query: ${statement.substring(0, 100)}...`);

        const queryOperation = await session.executeStatement(statement, {
            runAsync: true,
            params: parameters
        });

        const result = await queryOperation.fetchAll();
        await queryOperation.close();
        await session.close();
        console.log("Databricks session and operation closed.");

        return result;
    } catch (err) {
        console.error(`Error executing query on Databricks: ${err}`);
        throw new Error('Failed to execute query on Databricks.');
    } finally {
        if (client) {
            await client.close();
            console.log("Databricks client closed.");
        }
    }
}

module.exports = { 
    executeQuery
};