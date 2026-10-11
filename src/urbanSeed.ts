import type { Category, Item } from './types';

const groups: {name:string;color:string;items:[string,number,number?][]}[] = [
 {name:'Ala Carte — Pork',color:'#c48c59',items:[['Chinese Braised Ham Hock',750],['Crispy Pata',650],['Urban Casero Signature Ribs',350],['Sweet & Sour Pork',250],['Sinigang na Liempo',250],['Kare-Kareng Bagnet',200],['Sinigang na Bagnet',200],['Pork Binagoongan',170],['Tokwa\'t Baboy sa Tausi',170],['Lechon Kawali',160],['Chicharon Bulaklak',160],['Pork Sisig',160],['Tokwa\'t Baboy',150],['Sizzling Hungarian',140],['Pork Shanghai',130],['Pork Siomai',130],['Fried Pork BBQ',130],['Tokwa Dinakdakan',130]]},
 {name:'Ala Carte — Beef',color:'#b97962',items:[['Beef Bulalo',350],['Kalderetang Ribs ng Baka',250],['Sinigang na Baka',250],['Beef Teriyaki',220],['Beef & Mushroom',220],['Beef Broccoli',220]]},
 {name:'Ala Carte — Chicken',color:'#d1a05f',items:[['Chinese Savory Fried Chicken',400],['Fried Chicken Neck',200],['Chinese Chicken Feet',170],['Chicken Fillet',190],['Chicken Nuggets',150]]},
 {name:'Seafood & Grill',color:'#8daaa4',items:[['Cajun Seafood',300],['Cheesy Bake Bangus',300],['Inihaw na Liempo',250],['Grilled Scallops',220],['Shrimp Tempura',220],['Chicken Neck Inasal',200],['Shrimp Gambas',200],['Camaron Rebosado',200],['Beef Enoki Rolls',180],['Sinugbang Bangus',180],['Inihaw na Pusit',150],['Inihaw na Tilapia',150],['Pork Enoki Rolls',150]]},
 {name:'Vegetables',color:'#a7ad72',items:[['Beef Ampalaya',200],['Augratin',180],['Chopsuey',150],['Talong Bagoong',150],['Sipo Egg',150],['Vegetable Misono',150]]},
 {name:'Rice Meals',color:'#d2a76b',items:[['Grilled T-Bone',240],['Grilled Porterhouse',230],['Urban Casero Signature Ribs',180],['Chixilog',170],['Chicken Inasal (Petso)',160],['Chicken Inasal (Paa)',150],['Bangus Silog',130],['Liempo Silog',130],['Chicken Fillet Silog',109],['Lechon Kawali Silog',99],['Tapsilog',99],['Chichabusilog',99],['Fish Fillet Silog',99],['Sisig Silog',99],['Longasilog',99],['Pork Chop Silog',99],['Maling Silog',95],['Hungarian Silog',95],['Hotsilog',80]]},
 {name:'Rice Specialties',color:'#c9b483',items:[['Seafood Rice',300],['Yang Chow Rice',300],['Crabmeat Fried Rice',300],['Bagoong Rice',250]]},
 {name:'Soups',color:'#b7a17f',items:[['Cream of Asparagus',180],['Cream of Spinach',180],['Crab & Corn Soup',150],['Oriental Soup',150]]},
 {name:'Pasta & Noodles',color:'#cb987b',items:[['UC Shrimp Aglio Olio',180],['Chicken Alfredo',150],['Bacon & Mushroom Carbonara',150],['Filipino-Italian Spaghetti',150],['Chinese Savory Pancit Canton',150],['Chicken Lomi',150],['Palabok ala Quiapo',120]]},
 {name:'Chicken Wings',color:'#bd8250',items:[['6 pcs (1 flavor)',185,1],['12 pcs (2 flavors)',360,2],['30 pcs (5 flavors)',900,5],['60 pcs (6 flavors)',1800,6]]},
 {name:'Extras',color:'#d0bb91',items:[['Cheese Sauce',20],['Garlic Ranch',20],['Extra Flavor',30],['Jalapeño Cheese',20]]}
];
export const wingFlavors=['Classic','Garlic Parmesan','Teriyaki','Salted Egg','Honey Butter','Buttered Garlic','Hickory BBQ','Soy Garlic','Buffalo Spicy','Korean Spicy','Spicy Salted Egg','Sriracha','Spicy Korean BBQ','Yangnyeom'];
export function urbanMenu():{categories:Category[];items:Item[]}{
 const categories=groups.map((g,order)=>({id:`uc-${order}`,name:g.name,color:g.color,order}));
 const items=groups.flatMap((g,groupIndex)=>g.items.map(([name,pesos,flavorCount],itemIndex)=>({id:`uc-${groupIndex}-${itemIndex}`,name,description:groupIndex===9?'Select included flavors at no extra charge':'',categoryId:`uc-${groupIndex}`,price:pesos*100,image:'',available:true,...(flavorCount?{flavorCount}:{}),...(name==='Vegetable Misono'?{ownerVerification:true}:{} )})));
 return {categories,items};
}
