const express = require('express');
 
const app = express();
const cors = require('cors');
require('dotenv').config();
const stripe= require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;
//  middleware 
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kk0ds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

//${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kk0ds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Send a ping to confirm a successful connection

    const userCollection = client.db("bistroDb").collection("users");
    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewsCollection = client.db("bistroDb").collection("reviews");
    const cartCollection = client.db("bistroDb").collection("carts");
    const paymentCollection = client.db("bistroDb").collection("payments");
    
     // middleware
     const verifyToken = (req, res, next)=>{
      console.log('inside verify token',req.headers.authorization);
      if(!req.headers.authorization){
        res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
         if(err){
          res.status(401).send({message: 'unauthorized access'})
         }
         req.decoded= decoded;
      })
      next();
    }
    // use verifyAdmin after verifyToken
    const verifyAdmin= async(req, res, next)=>{
      const email = req.decoded.email;
      console.log('Decoded email:', req.decoded.email);
      const query={email: email};
      const user= await userCollection.findOne(query);
      const isAdmin = user?.role ==='admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
      }
      next();
    }


    //jwt related api 
    app.post('/jwt', async (req, res)=>{
      const user = req.body;
      const token= jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({token});
    })
    
    // Users collection 
    app.post('/users', async(req, res)=>{
      const user= req.body;
      // insert email if user doesn't exists 
      // you can do this many ways(1. email unique 2. upsert 3. simple checking)
      const query ={email: user.email};
      const existingUser= await userCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exists', insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })
    
   
    app.get('/users', verifyToken, verifyAdmin, async(req,res)=>{
    
        const result = await userCollection.find().toArray();
        res.send(result);
    })
    app.get('/users/admin/:email', verifyToken, async(req, res)=>{
       const email = req.params.email;
       if(email != req.decoded.email){
         return res.status(403).send({message: 'forbidden access'});
       }
       const query = {email: email};
       const user= await userCollection.findOne(query);
       let admin = false;
       if(user){
          admin = user?.role === 'admin';
       }
       res.send({admin});
    })
    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res)=>{
       const id = req.params.id;
      
       const query ={ 
         _id: new ObjectId(id)
       }
       const result = await userCollection.deleteOne(query);
       res.send(result);
    })
    
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const filter={
        _id: new ObjectId(id)
      }
      const updatedDoc={
        $set: { role: 'admin'}
      }
      const result= await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    app.get('/menu', async (req, res) => {

      const result = await menuCollection.find().toArray();
      res.send(result);

    })
    app.get('/menu/:id', async(req, res)=>{
       const id = req.params.id;
       const queryWithObID={ _id: new ObjectId(id) };
       const queryWithID={ _id: (id) };

       let result = await menuCollection.findOne(queryWithObID);
       console.log('hi',result);
       if(!result){
        console.log('Hello');
        result = await menuCollection.findOne(queryWithID);
       }
      
       res.send(result);
      }
    )
    
    app.post('/menu', verifyToken, verifyAdmin, async(req, res)=>{
      const menuItem= req.body;
      const result= await menuCollection.insertOne(menuItem);
      res.send(result);
    })

    app.patch('/menu/:id', verifyToken, verifyAdmin,  async(req, res)=>{
       const item= req.body;
       const id= req.params.id;
       let filter= {_id: new ObjectId(id)};
       const updatedDoc={
        $set:{
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
       }
       let result = await menuCollection.updateOne(filter,updatedDoc);
       if(result.modifiedCount===0) {
         filter={ _id: (id) }
        result= await menuCollection.updateOne(filter, updatedDoc);
       }
       console.log('patch',result);
       res.send(result);
    })
   

    
    app.delete('/menu/:id', verifyToken, verifyAdmin,  async(req, res)=>{
       const id = req.params.id;
       console.log('Backend received delete for ID:', id);
       const queryWithObID={ _id: new ObjectId(id) };
       const queryWithID={ _id: (id) };

       let result = await menuCollection.deleteOne(queryWithObID);
       console.log('hi',result);
       if(result.deletedCount==0){
        result = await menuCollection.deleteOne(queryWithID);
       }
       res.send(result);
    })
    app.get('/reviews', async (req, res) => {

      const result = await reviewsCollection.find().toArray();
      res.send(result);

    })
    app.get('/carts', async (req, res)=>{
      const email= req.query.email;
      const query= {email: email};
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })
    app.delete('/carts/:id', async(req,res)=>{
      const id = req.params.id;
      const query={_id: new ObjectId(id)};
      const result = await cartCollection.deleteOne(query);
      res.send(result);n
    })
    // carts collection
    app.post('/carts', async (req, res)=>{
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })
    // Payment intent 
    app.post('/create-payment-intent', async(req,res)=>{
       const {price}= req.body;
       const amount= parseInt(price * 100);
       const paymentIntent= await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
       })
       res.send({
         clientSecret: paymentIntent.client_secret
        
       })
    })
    app.post('/payments', async(req, res)=>{
      const payment= req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // carefully delete each item from the card 
      console.log('payment Info', payment);
      
      const query={_id:{
        $in: payment.cartIds.map(id=> new ObjectId(id))
      }};
      const deleteResult= cartCollection.deleteMany(query);
      res.send({paymentResult, deleteResult});

    })
    app.get('/payments/:email', verifyToken, async(req, res)=>{
      const email= req.params.email;
      const query={email: email};

      if(email != req.decoded.email){
        return res.status(403).send({message:'forbidden access'});
      }

      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/admin-stats', verifyToken, verifyAdmin, async(req, res)=>{
       const users = await userCollection.estimatedDocumentCount();
       const menuItems = await menuCollection.estimatedDocumentCount();
       const orders= await paymentCollection.estimatedDocumentCount();
       
       const result = await paymentCollection.aggregate([
        {
           $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
           }
        }
       ]).toArray();
       const revenue = result.length >0? result[0].totalRevenue: 0;

       res.send({users, menuItems, orders, revenue});

    })
    app.get('/order-stats', verifyToken,verifyAdmin, async(req, res)=>{
      const result = await paymentCollection.aggregate([
         {
          $unwind: '$menuItemIds'
         } ,
         {
          $lookup: {
            from: 'menu',
            localField: 'menuItemIds', 
            foreignField: '_id',
             as: 'menuItems'
          }
         },
         {
          $unwind: '$menuItems'
         },
         {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1},
            revenue: { $sum: '$menuItems.price'}
          }
         },
         {
          $project:{
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
         }
      ]).toArray();
      res.send(result);
    })
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('boss is sitting')
})
app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`)
})