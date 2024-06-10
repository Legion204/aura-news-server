const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://aura-news-d0504.web.app",
      "https://aura-news-d0504.firebaseapp.com",
    ]
  })
);
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
    const publicationCollection = client.db("newsDB").collection("publications");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' });
      res.send({ token });
    });

    // Custom middlewares 
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" })
      }
      next();
    }

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
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/admin/:id",  async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const doc = {
        $set: {
          role: "admin"
        }
      }
      const result = await userCollection.updateOne(query, doc)
      res.send(result)
    });

    app.get("/users/admin", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    // article related api
    app.post("/articles", async (req, res) => {
      const data = req.body
      const result = await articleCollection.insertOne(data);
      res.send(result);
    });

    app.get("/articles", verifyToken, async (req, res) => {
      const query = { status: "approved", isPremium: false }
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/article/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await articleCollection.findOne(query)
      res.send(result);
    });

    app.get("/premium_articles", verifyToken, async (req, res) => {
      const query = { isPremium: true, status: "approved" }
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/my_articles", verifyToken, async (req, res) => {
      const email = req.query.email
      const query = { authorEmail: email }
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/my_article/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await articleCollection.deleteOne(query)
      res.send(result);
    });

    app.put("/update_article/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updatedArticle = req.body
      const doc = {
        $set: {
          articleTitle: updatedArticle.articleTitle,
          details: updatedArticle.details
        }
      }
      const result = await articleCollection.updateOne(query, doc, options);
      res.send(result);
    });

    app.get("/trending_articles", async (req, res) => {
      const query = { status: "approved", isPremium: false }
      const result = await articleCollection.find(query).sort({ articleView: -1 }).toArray();
      res.send(result);
    });

    // api for admin
    app.get("/articles/admin", verifyToken, verifyAdmin, async (req, res) => {
      const result = await articleCollection.find().toArray();
      res.send(result);
    });

    app.patch("/article/approve/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const doc = {
        $set: {
          status: "approved"
        }
      }
      const result = await articleCollection.updateOne(query, doc)
      res.send(result)
    });

    app.patch("/article/premium/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const doc = {
        $set: {
          isPremium: true
        }
      }
      const result = await articleCollection.updateOne(query, doc)
      res.send(result)
    });

    app.patch("/article/decline/:id", async (req, res) => {
      const id = req.params.id;
      const declineReason = req.body

      const query = { _id: new ObjectId(id) };
      const doc = {
        $set: {
          status: "declined",
          reason: declineReason.reason
        }
      }
      const result = await articleCollection.updateOne(query, doc)
      res.send(result)
    });

    app.post("/publications", async (req, res) => {
      const publication = req.body
      const result = await publicationCollection.insertOne(publication)
      res.send(result)
    });

    app.get("/publications", async (req, res) => {
      const result = await publicationCollection.find().toArray()
      res.send(result)
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