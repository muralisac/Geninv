// ⚠️ ADMIN EMAIL
const ADMIN_EMAILS = ["sundara.murali@gmail.com"];

const firebaseConfig = {
    apiKey: "AIzaSyDXjWRxYh0zHENw_9zHH9pjHUlKxhy-QVU",
    authDomain: "geninv-9583c.firebaseapp.com",
    projectId: "geninv-9583c",
    storageBucket: "geninv-9583c.firebasestorage.app",
    messagingSenderId: "1001857058399",
    appId: "1:1001857058399:web:8b36dcce49ef0cf6747dea"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); 

let appData = { inventory: [], customers: [], history: [], purchaseOrders: [], lastInvoiceNum: 22, lastPoNum: 5 };
const SELLER_STATE = 33; 

let currentCart = []; let editingDocId = null; let tempDocNumber = ""; let tempDocDate = "";
let currentDocType = "invoice"; let isAdmin = false;