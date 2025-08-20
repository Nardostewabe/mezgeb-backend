import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();


if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing!");
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.use(cors());
app.use(express.json());

//get all brands
app.get("/getBrands", async (req, res) => {
  try {
    const brandsRef = db.collection("Brands");
    const querySnapshot = await brandsRef.orderBy("brand_name").get();
    
    const brands = [];
    querySnapshot.forEach((doc) => {
      brands.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json(brands);
  } catch (err) {
    console.error("Error fetching brands:", err);
    res.status(500).send("Error fetching brands");
  }
});


//get brand items from all items
app.get("/items/brand/:brandName", async (req, res) => {
  try {
    const brandName = req.params.brandName;
    const itemsRef = db.collection("All_Items");

    const q = itemsRef.where("brand_name", "==", brandName);

    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return res.status(200).json([]);
    }

    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching items by brand:", err);
    res.status(500).send("Error fetching items by brand");
  }
});


//get all items
app.get("/items", async (req, res) => {
  try {
    const itemsRef = db.collection("All_Items");
    // We order by creation date to show the newest items first. 'desc' is for descending.
    const q = itemsRef.orderBy("createdAt", "desc");
    
    const querySnapshot = await q.get();

    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching all items:", err);
    res.status(500).send("Error fetching all items");
  }
});


//filter by gender api
app.get("/items/gender/:gender", async (req, res) => {
  try {
    // Get the gender ('male' or 'female') from the URL parameter
    const gender = req.params.gender;

    if (gender !== 'male' && gender !== 'female') {
      return res.status(400).send("Invalid gender specified. Use 'male' or 'female'.");
    }

    const itemsRef = db.collection("All_Items");
    const q = itemsRef.where("gender", "==", gender);
    
    const querySnapshot = await q.get();
    
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching items by gender:", err);
    res.status(500).send("Error fetching items by gender");
  }
});

//filter by category for genders
app.get("/items/:gender/category/:categoryName", async (req, res) => {
  try {
    
    // 1. Extract both gender and category from the URL parameters
    const { gender, categoryName } = req.params;

    // 2. Validate the input to ensure both params are present
    if (!gender || !categoryName) {
      return res
        .status(400)
        .send("Both gender and category name are required.");
    }

    // Validate 
    const validGenders = ["male", "female", "unisex"];
    if (!validGenders.includes(gender.toLowerCase())) {
        return res.status(400).send("Invalid gender specified.");
    }

    const itemsRef = db.collection("All_Items");

    // 3. Chain .where() clauses to create a compound query
    // This finds documents WHERE gender matches AND category.name matches
    const q = itemsRef
      .where("gender", "==", gender.toLowerCase())
      .where("category.name", "==", categoryName.toLowerCase());

    const querySnapshot = await q.get();

    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching items by gender and category:", err);
    res.status(500).send("Error fetching items");
  }
});

//filter by category and subcategory
app.get("/items/filter/:categoryName/:subCategoryName", async (req, res) => {
  try {
    const { categoryName, subCategoryName } = req.params;

    const itemsRef = db.collection("All_Items");
    // This is a compound query, filtering on two different fields
    const q = itemsRef
      .where("category.name", "==", categoryName)
      .where("subCategory", "==", subCategoryName);
    
    const querySnapshot = await q.get();
    
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching items by category and subcategory:", err);
    res.status(500).send("Error fetching items by category and subcategory");
  }
});

//search by subcategory name
app.get("/items/subcategory/:subCategoryName", async (req, res) => {
  try {
    const { subCategoryName } = req.params;

    const itemsRef = db.collection("All_Items");
    const q = itemsRef.where("subCategory", "==", subCategoryName);
    
    const querySnapshot = await q.get();
    
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching items by subcategory:", err);
    res.status(500).send("Error fetching items by subcategory");
  }
});

//search functionality
app.get("/search", async (req, res) => {
  try {
    const searchTerm = req.query.q; // We will get the search term from a query parameter like /search?q=nike

    if (!searchTerm) {
      return res.status(400).send("A search term 'q' is required.");
    }

    const itemsRef = db.collection("All_Items");

    // Create two separate query promises
    const brandQuery = itemsRef.where('brand_name', '==', searchTerm).get();
    const subCategoryQuery = itemsRef.where('subCategory', '==', searchTerm).get();

    // Run both queries in parallel for efficiency
    const [brandSnapshot, subCategorySnapshot] = await Promise.all([brandQuery, subCategoryQuery]);

    const resultsMap = new Map();

    // Add results from the brand query to the map
    brandSnapshot.forEach(doc => {
      resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Add results from the subcategory query. The map will automatically handle duplicates.
    subCategorySnapshot.forEach(doc => {
      resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Convert the map values back to an array
    const combinedResults = Array.from(resultsMap.values());

    res.status(200).json(combinedResults);

  } catch (err) {
    console.error("Error during search:", err);
    res.status(500).send("Error performing search");
  }
});

//filtering by category