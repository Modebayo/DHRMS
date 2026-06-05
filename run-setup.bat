@echo off
cd /d "C:\Users\HP\Desktop\ALAGBEDE IBRAHIM MODEBAYO FN PROJECT"
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth(), db = admin.firestore();

const STUDENTS = [
  {name:'Alagbede Ibrahim Modebayo',email:'ibrahimbayo821@gmail.com'},
  {name:'Ojo Paul',email:'ojopaul65@gmail.com'},
  {name:'Goke-Adenrele Adekunmi ADL',email:'tonykunmi@gmail.com'},
  {name:'Nyeche Charles Martins',email:'programmermartins@gmail.com'},
  {name:'Enietan-matthews Stephanie',email:'enietanstephanie@gmail.com'},
  {name:'Nwachukwu Chukwuebuka Favour',email:'chukwuebukadevv@gmail.com'},
  {name:'Abon Bamise Ebenezer',email:'bamisetoyin9@gmail.com'},
  {name:'Odumuyiwa Favour Oyerinola',email:'odumuyiwafavour@gmail.com'},
  {name:'Adewusi Obaloluwa John',email:'adewusiobaloluwa80@gmail.com'},
  {name:'Salami Usman Ayomide',email:'salamusman1009@gmail.com'},
  {name:'Akinde Akintomiwa Samuel',email:'akindeakintomiwa88@gmail.com'},
  {name:'Awonugba Boluwatife Richard',email:'awonugbabolu62@gmail.com'},
  {name:'Nathan John Akachukwu',email:'nathanjohnlagos@gmail.com'}
];

async function run() {
  console.log('=== Creating Admin Account ===');
  try {
    let user;
    try { user = await auth.getUserByEmail('ibrotech974@gmail.com'); console.log('Admin exists.'); }
    catch(e) { user = await auth.createUser({email:'ibrotech974@gmail.com',password:'Neon10@2026',displayName:'ALAGBEDE IBRAHIM MODEBAYO',emailVerified:true}); console.log('Admin created.'); }
    await db.collection('users').doc(user.uid).set({firstName:'ALAGBEDE',lastName:'IBRAHIM MODEBAYO',email:'ibrotech974@gmail.com',userId:'admin001',role:'admin',status:'active',emailVerified:true,phone:'',dateOfBirth:'',department:'Administration',createdAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    await auth.setCustomUserClaims(user.uid,{role:'admin'});
    console.log('Admin ready: ibrotech974@gmail.com / Neon10@2026');
  } catch(e) { console.error('Admin error:',e.message); }

  console.log('\n=== Creating Student Accounts ===');
  let ok=0,skip=0,fail=0;
  for(const s of STUDENTS) {
    const parts=s.name.split(' '), first=parts.slice(0,-1).join(' ')||parts[0], last=parts[parts.length-1];
    try {
      let user;
      try { user=await auth.getUserByEmail(s.email); skip++; }
      catch(e) { user=await auth.createUser({email:s.email,password:'Student@2026',displayName:s.name,emailVerified:true}); ok++; }
      await db.collection('users').doc(user.uid).set({firstName:first,lastName:last,email:s.email,role:'student',status:'active',emailVerified:true,department:'Software Engineering',level:'UTME-100',createdAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      await auth.setCustomUserClaims(user.uid,{role:'student'});
      process.stdout.write((ok+skip)+'/'+STUDENTS.length+' '+s.email+' ['+(skip?'skipped':'created')+']\n');
    } catch(e) { fail++; console.error('FAIL',s.email,e.message); }
  }
  console.log('\nDone! Created:'+ok+' Skipped:'+skip+' Failed:'+fail);
  console.log('\nStudent password: Student@2026');
  process.exit(0);
}
run().catch(e=>{console.error(e);process.exit(1);});
" 2>&1
pause
