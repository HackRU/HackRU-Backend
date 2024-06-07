import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB } from '../../util';
import * as config from '../../config';

const attend_event: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {

    const attend_event = await queryByEmail(event.body.email, config.DEV_MONGO_URI)
    if(attend_event === null) {
        return {
            statusCode: 404,
            body: JSON.stringify({
                message: "user not found"
            })
        }
    }
    if(attend_event.registration_status === "registered") {
        return {
            statusCode: 402, 
            body: JSON.stringify({  
                message: "user already checked into event"
            })
        }
    } else {

        // Updates the user's registration status to registered on the database
        await attend_event.updateOne( {registration: 'registered'} );

        return {
            statusCode: 200, 
            body: JSON.stringify({  
                email: event.body.email
            })
        }
    }
};

async function queryByEmail(email: string, mongoURI: string) {
    // Connect to MongoDB
    try {
        const db = MongoDB.getInstance(mongoURI);
        await db.connect();
        const client = db.getClient()

        // Access the database and collection
        const collection = client.db('dev').collection(config.DB_COLLECTIONS['users']);

        // Query the object based on the email
        const result = await collection.findOne({ email });

        // If the object exists, return it
        if (result) {
            return result;
        } else {
            // If the object does not exist, return null or throw an error
            return null;
        }
    } catch (error) {
        console.error('Error querying MongoDB:', error);
        throw error;
    } 
}

export const main = middyfy(attend_event);