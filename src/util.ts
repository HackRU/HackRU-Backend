import { MongoClient } from 'mongodb';

// cache connection so only one copy is used
export class MongoDB {
  private static instance: MongoDB;
  private client: MongoClient;

  private constructor(uri: string) {
    this.client = new MongoClient(uri);
  }

  public static getInstance(uri: string): MongoDB {
    if (!MongoDB.instance) 
      MongoDB.instance = new MongoDB(uri);
    
    return MongoDB.instance;
  }

  public async connect(): Promise<void> {
    // const ping = await this.client.db().command({ ping: 1 });
    // if (ping?.ok === 1) {
    //     await this.client.connect();
    // }
    try {
      await this.client.db().command({ ping: 1 });
      // Ping was successful
    } catch (error) {
      // An error occurred while pinging the database
      await this.client.connect();
    }
  }

  public getClient(): MongoClient {
    return this.client;
  }
}

// Usage example
// const mongoURI = config.DEV_MONGO_URI;
// const db = MongoDB.getInstance(mongoURI);
// db.connect()
//     .then(async () => {
//         const client = db.getClient();
//         // Use the MongoDB client instance for database operations (example given below)
//         const database = client.db('dev');
//         const collection = database.collection('users');

//         const result = await collection.findOne({ "email": "test@test.org" });
//         console.log(result['registrationStatus'])
//     })
//     .catch((error) => {
//         console.error('Error connecting to MongoDB:', error);
//     });
