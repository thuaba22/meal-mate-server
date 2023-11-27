const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.unqmcva.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const mealsCollection = client.db("mealsDB").collection("meals");
    const packageCollection = client.db("mealsDB").collection("premium");
    const usersCollection = client.db("mealsDB").collection("users");

    // Get all meals
    app.get("/meals", async (req, res) => {
      const cursor = mealsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get all premium packages
    app.get("/premium", async (req, res) => {
      const cursor = packageCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get a specific meal by ID
    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };

      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    // Update likes for a specific meal by ID
    app.put("/meals/like/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };
        const update = { $inc: { likes: 1 } };

        const result = await mealsCollection.updateOne(query, update);

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Like updated successfully." });
        } else {
          res.status(404).json({ success: false, message: "Meal not found." });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });

    app.post("/meals/review", async (req, res) => {
      const { mealId, user, comment } = req.body;

      try {
        const query = { _id: new ObjectId(mealId) };
        const update = { $push: { reviews: { user, comment } } };

        const result = await mealsCollection.updateOne(query, update);

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Review added successfully." });
        } else {
          res.status(404).json({ success: false, message: "Meal not found." });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });
    app.post("/register", async (req, res) => {
      try {
        const userData = req.body;

        // Save user information to the users collection
        const result = await usersCollection.insertOne({
          ...userData,
          badge: "Bronze", // Add the default badge here
        });

        // Check if the user was inserted successfully
        if (result.insertedCount > 0) {
          res.json({ success: true, message: "User registered successfully." });
        } else {
          res
            .status(500)
            .json({ success: false, message: "Failed to register user." });
        }
      } catch (error) {
        console.error("Error during user registration:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error." });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Meal Mate Server is running");
});

app.listen(port, () => {
  console.log(`Meal Mate Server is running on port: ${port}`);
});
