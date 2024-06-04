const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.tba2ihq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // database collection
    const articleCollection = client.db("newsDB").collection("articles");
    const userCollection = client.db("newsDB").collection("users");

    // user related api
    app.post('/users', async (req, res) => {
      const user = req.body

      // check if user is already in database
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.post("/articles", async (req, res) => {
      const data = req.body
      const result = await articleCollection.insertOne(data);
      res.send(result)
    });

    app.get("/articles", async (req, res) => {
      const query = { status: "approved" , isPremium: false }
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/article/:id",async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await articleCollection.findOne(query)
      res.send(result)
    });

    app.get("/premium_articles", async (req, res) => {
      const query = { isPremium: true , status: "approved" }
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/my_articles", async (req, res) => {
      const email = req.query.email
      const query = { authorEmail: email }
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send("Aura News Server is running")
});

app.listen(port, () => {
  console.log(`Aura News Server is running on port ${port}`);
});