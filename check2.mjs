import mongoose from "mongoose";
import Customer from './src/api/sales/customer.model.js';
(async()=>{
  try {
    await mongoose.connect("$uri");
    const codes = await Customer.find().select('customerCode').limit(10).sort({customerCode:1});
    console.log('sample', codes.map(c=>c.customerCode));
    const agg = await Customer.aggregate([
      { $match: { customerCode: { $regex: /^CUST-/ } } },
      { $project: { n: { $toInt: { $substr: ['$customerCode',5,-1] } } } },
      { $sort: { n: -1 } },
      { $limit: 1 }
    ]);
    console.log('max', agg);
  } catch(e) { console.error(e); }
  process.exit(0);
})();
