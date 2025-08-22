const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyEdD54_HQE9rFbh-OjA5-b863v3SZkU8pQd8agzEbPmnyHCuG53zNO-hlxJMRCALbj/exec';
const $ = sel=>document.querySelector(sel);
function show(id){document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}

document.addEventListener('DOMContentLoaded',()=>{
  $('#btn-signup').onclick = ()=>show('signup');
  $('#btn-login').onclick = ()=>show('login');
  $('#nav-signup').onclick = ()=>show('signup');
  $('#nav-login').onclick = ()=>show('login');
  $('#nav-index').onclick = ()=>show('home');
  $('#nav-contact').onclick = ()=>show('contact');
  $('#nav-privacy').onclick = ()=>show('privacy');
  $('#nav-refundpolicy').onclick = ()=>show('refundpolicy');
  $('#link-to-login').onclick = ()=>show('login');

  // signup
  $('#signupForm').onsubmit = async (e)=>{
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {action:'signup', name:form.get('name'), email:form.get('email'), college:form.get('college'), password:form.get('password'), upi:form.get('upi')};
    const res = await post(payload);
    alert(res.message);
    if(res.success) show('login');
  }

  // login
  $('#loginForm').onsubmit = async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const payload={action:'login', userid:f.get('userid'), password:f.get('password')};
    const res = await post(payload);
    if(res.success){
      const expiry = Date.now() + (2*60*60*1000); // 2 hours
      localStorage.setItem('flexi_session', JSON.stringify({userid:res.userid, expiry}));
      renderDashboard(res.userid);
      show('dashboard');
    } else alert(res.message);
  }

  // forgot password (by UserID)
  $('#forgotPwd').onclick = async (e)=>{
    e.preventDefault();
    const userid = prompt('Enter your User ID (e.g., FLEXI-123456)');
    if(!userid) return;
    const r = await post({action:'resetByUserId', userid});
    alert(r.message);
  }

  // logout
  $('#logout').onclick = ()=>{localStorage.removeItem('flexi_session');show('home');}

  // payment flow
  $('#btn-pay').onclick = async ()=>{
    const session = JSON.parse(localStorage.getItem('flexi_session')||'null');
    if(!session || session.expiry < Date.now()){alert('Session expired — login again'); show('login'); return}
    const userid = session.userid;
    const qty = Number($('#buy-qty').value||1);
    const payload = {action:'getPrice', mealType:$('#buy-type').value, qty, userid};
    const r = await post(payload);
    if(!r.success){alert(r.message); return}
    const amount = r.amount; $('#buy-amount').innerText = `₹${amount}`;
    const upiTo = r.merchantUpi || 'fleximeal@bank';
    const note = encodeURIComponent(`FlexiMeal ${userid}`);
    const upi = `upi://pay?pa=${encodeURIComponent(upiTo)}&pn=FlexiMeal&am=${amount}&tn=${note}`;
    if(confirm(`You will be redirected to your UPI app for ₹${amount}. After paying, you must enter the UTR.`)){
      window.location = upi;
      const utr = prompt('Enter UTR / transaction reference');
      if(!utr){alert('UTR required.'); return}
      const payPayload = {action:'submitPayment', userid, amount, qty, upiTo, utr, email:$('#buy-email').value};
      const payRes = await post(payPayload);
      alert(payRes.message);
      if(payRes.success) $('#pay-result').innerText = 'Payment submitted; awaiting admin verification.';
    }
  }

  // refund request
  $('#btn-request-refund').onclick = async ()=>{
    const session = JSON.parse(localStorage.getItem('flexi_session')||'null');
    if(!session || session.expiry < Date.now()){alert('Session expired — login again'); show('login'); return}
    const payload = {action:'requestRefund', userid:session.userid, meal:$('#refund-meal').value, qty: Number($('#refund-qty').value), email:$('#refund-email').value};
    const res = await post(payload);
    alert(res.message);
    if(res.success) $('#refund-result').innerText = 'Refund request submitted.';
  }

  // contact
  $('#contactForm').onsubmit = async e=>{e.preventDefault();const fd=new FormData(e.target);const res=await post({action:'contact',name:fd.get('name'),email:fd.get('email'),message:fd.get('message')});alert(res.message)}

  const s = JSON.parse(localStorage.getItem('flexi_session')||'null'); if(s && s.expiry>Date.now()){renderDashboard(s.userid); show('dashboard')}
})

async function renderDashboard(userid){
  $('#dash-userid').textContent = userid;
  const res = await post({action:'getDashboard', userid});
  if(res.success){
    if(res.refunded && res.refunded.length) {
      $('#refunded-list').innerHTML = res.refunded.map(r=>`<div><b>${r.meal}</b> — ${r.qty} @ ₹${r.discountedPrice} <button onclick="buyRefunded('${r.rowId}')">Buy</button></div>`).join('');
    } else $('#refunded-list').innerText = '— No items available —';
    if(res.adsHtml){ document.getElementById('ads').innerHTML = res.adsHtml; }
  }
}

window.buyRefunded = async (rowId)=>{
  const session = JSON.parse(localStorage.getItem('flexi_session')||'null'); if(!session || session.expiry<Date.now()){alert('Session expired');return}
  const r = await post({action:'buyRefunded', userid:session.userid, rowId});
  alert(r.message);
}

async function post(payload){
  try{
    const res = await fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    return await res.json();
  }catch(e){return {success:false,message:e.message}}
}