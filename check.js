const mongoose=require('mongoose');
const Customer=require('./src/api/sales/customer.model.js').default;
(async()=>{
  await mongoose.connect('mongodb://localhost:27017/erp',{useNewUrlParser:true,useUnifiedTopology:true});
  const codes=await Customer.find().select('customerCode').limit(20).sort({customerCode:1});
  console.log(codes.map(c=>c.customerCode));
  const agg=await Customer.aggregate([
    { $match:{ customerCode:{ $regex:/^CUST-/ } } },
    { $project:{ n:{ $toInt:{ $substr:['$customerCode',5,-1] } } } },
    { $sort:{ n:-1 } },
    { $limit:1 }
  ]);
  console.log('max n',agg);
  process.exit(0);
})();
