import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdCydQHhoW9S2pt0NN68pu5JPg1xE0kdo",
  authDomain: "lilygolfcartservices-4d1df.firebaseapp.com",
  projectId: "lilygolfcartservices-4d1df",
  storageBucket: "lilygolfcartservices-4d1df.firebasestorage.app",
  messagingSenderId: "526553300100",
  appId: "1:526553300100:web:585530fb0eae6083a856d1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Socket.IO
const socket = io();

const CAMPUS_HUBS = {
    'MIT ADT Main Gate': { lat: 18.4902233, lng: 74.0255954 },
    'Food Tech / Mandir': { lat: 18.4909476, lng: 74.0224796 },
    'IT Building': { lat: 18.4925779, lng: 74.0202085 },
    'Bio Engineering': { lat: 18.4938431, lng: 74.0216479 },
    'Raj Mess': { lat: 18.493502, lng: 74.0240622 },
    'Sports Complex': { lat: 18.492393, lng: 74.0259036 },
};

// Application State
let appState = {
    user: null, 
    pendingAuthPhone: null,
    watchId: null, 
    selectedCartId: null,
    selectedSeats: [],
    route: { pickup: null, dropoff: null },
    cartData: {},
    walletBalance: 0.00,
    walletTransactions: [],
    rideHistory: [],
    profile: {
        name: "User Name",
        phone: "+91 0000000000"
    },
    maps: {
        student: null,
        driver: null,
        markers: {},
        infoWindows: {}
    }
};

// Map State
let maps = { student: null, driver: null };
let mapMarkers = {
    studentCarts: {},
    driverCarts: {},
    hubs: []
};

// Custom Google Maps Theme (Dark Teal / Cyan)
const customMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
    },
    {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#114b5f" }], // Dark Teal
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
    },
];

window.currentAuthRole = 'student';

// DOM Elements
const containers = {
    authFlow: document.getElementById('auth-flow-container'),
    mainApp: document.getElementById('main-app-container')
};

const authViews = {
    splash: document.getElementById('splash-view'),
    signup: document.getElementById('signup-view'),
    login: document.getElementById('login-view'),
    otp: document.getElementById('otp-view')
};

const appViews = {
    studentDashboard: document.getElementById('student-dashboard-view'),
    seatSelection: document.getElementById('seat-selection-view'),
    driverDashboard: document.getElementById('driver-dashboard-view')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupRecaptcha();

    document.getElementById('signup-form').addEventListener('submit', handleSignupSendOTP);
    document.getElementById('login-form').addEventListener('submit', handleLoginSendOTP);
    document.getElementById('otp-form').addEventListener('submit', handleVerifyOTP);
    
    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
        // Reset the active ride view if they were confirmed
        document.getElementById('student-active-ride-section').classList.add('hidden');
        showAppView('studentDashboard');
    });
    
    document.getElementById('btn-find-carts').addEventListener('click', handleFindCarts);
    document.getElementById('btn-confirm-booking').addEventListener('click', handleConfirmBooking);
    document.getElementById('toggle-duty').addEventListener('change', handleDutyToggle);

    populateHubDropdowns();
    setupOTPInputs();

    const activeSession = localStorage.getItem('active_session_phone');
    if (activeSession) {
        const userStr = localStorage.getItem(`user_${activeSession}`);
        if (userStr) {
            appState.user = JSON.parse(userStr);
            transitionToMainApp();
            return;
        }
    }
    switchAuthView('splash-view');
});

// Expose globally
window.switchAuthView = function(viewId, role = null) {
    if (role) {
        window.currentAuthRole = role;
        
        // Handle dynamic fields based on role
        const driverFields = document.getElementById('driver-signup-fields');
        const signupTitle = document.getElementById('signup-title');
        const loginTitle = document.getElementById('login-title');
        
        if (role === 'driver') {
            if (driverFields) driverFields.classList.remove('hidden');
            if (signupTitle) signupTitle.innerText = "Driver Sign Up";
            if (loginTitle) loginTitle.innerText = "Driver Login";
        } else {
            if (driverFields) driverFields.classList.add('hidden');
            if (signupTitle) signupTitle.innerText = "Create Account";
            if (loginTitle) loginTitle.innerText = "Welcome Back";
        }
    }

    Object.values(authViews).forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('fade-in');
    });
    const target = document.getElementById(viewId);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in');
    }
};

function showAppView(viewName) {
    Object.values(appViews).forEach(v => {
        if(v) v.classList.add('hidden');
    });
    if(appViews[viewName]) {
        appViews[viewName].classList.remove('hidden');
        appViews[viewName].classList.add('fade-in');
    }
    
    // Ensure map resizes correctly if it was hidden during initialization
    const defaultCenter = { lat: 18.4922, lng: 74.0220 };
    if (viewName === 'studentDashboard' && appState.maps.student && window.google) {
        google.maps.event.trigger(appState.maps.student, 'resize');
        appState.maps.student.setCenter(defaultCenter);
    }
    if (viewName === 'driverDashboard' && appState.maps.driver && window.google) {
        google.maps.event.trigger(appState.maps.driver, 'resize');
        appState.maps.driver.setCenter(defaultCenter);
    }
}

// --- Navigation Drawer & Overlays ---

window.toggleDrawer = function() {
    const drawer = document.getElementById('nav-drawer');
    const backdrop = document.getElementById('nav-drawer-backdrop');
    
    if (drawer.classList.contains('-translate-x-full')) {
        drawer.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
    } else {
        drawer.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    }
};

window.openOverlayView = function(viewId) {
    toggleDrawer(); // close drawer
    
    if (viewId === 'home') {
        closeOverlayView();
        return;
    }

    document.getElementById('overlay-views-container').classList.remove('hidden');
    
    // Hide all internal views
    ['wallet-view', 'history-view', 'profile-view'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    const targetEl = document.getElementById(viewId);
    if(targetEl) {
        targetEl.classList.remove('hidden');
        targetEl.classList.add('flex');
    }

    // Set Title
    const titleEl = document.getElementById('overlay-title');
    if (viewId === 'wallet-view') {
        titleEl.innerText = "Wallet & Payments";
        renderWallet();
    } else if (viewId === 'history-view') {
        titleEl.innerText = "Ride History";
        renderHistory();
    } else if (viewId === 'profile-view') {
        titleEl.innerText = "My Profile";
        renderProfile();
    }
};

window.closeOverlayView = function() {
    document.getElementById('overlay-views-container').classList.add('hidden');
};

// --- Dynamic Render Functions ---

window.renderWallet = function() {
    document.getElementById('wallet-balance-display').innerText = `₹${appState.walletBalance.toFixed(2)}`;
    
    const list = document.getElementById('wallet-transactions-list');
    if (appState.walletTransactions.length === 0) {
        list.innerHTML = `<p class="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">No recent transactions.</p>`;
    } else {
        list.innerHTML = appState.walletTransactions.map(tx => `
            <div class="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                    <p class="font-bold text-gray-900">${tx.title}</p>
                    <p class="text-xs text-gray-500">${tx.date}</p>
                </div>
                <p class="font-bold ${tx.amount < 0 ? 'text-red-500' : 'text-emerald-500'}">
                    ${tx.amount > 0 ? '+' : ''}₹${Math.abs(tx.amount).toFixed(2)}
                </p>
            </div>
        `).join('');
    }
};

window.addFunds = async function(amount) {
    if (!appState.user || !appState.user.phone) return;
    
    try {
        const res = await fetch('/api/users/wallet/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: appState.user.phone, amount })
        });
        const data = await res.json();
        
        if (data.walletBalance !== undefined) {
            appState.walletBalance = data.walletBalance;
            appState.walletTransactions = data.walletTransactions;
            renderWallet();
            alert(`₹${amount} added successfully!`);
        }
    } catch (err) {
        alert("Failed to add funds.");
    }
};

window.renderHistory = async function() {
    const list = document.getElementById('ride-history-list');
    list.innerHTML = '<div class="text-center text-gray-500 py-8">Loading history...</div>';
    
    try {
        const role = window.currentAuthRole || (appState.user && appState.user.role) || 'student';
        const response = await fetch(`/api/rides/history/${appState.user.phone}?role=${role}`);
        const history = await response.json();
        
        if (!history || history.length === 0) {
            list.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-history text-4xl mb-4 text-gray-300"></i>
                    <p>No past rides found.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = history.map(ride => `
            <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 flex justify-between items-center">
                <div>
                    <div class="font-medium text-gray-800">${new Date(ride.createdAt).toLocaleDateString()} ${new Date(ride.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <div class="text-sm text-gray-500">${role === 'student' ? 'Driver: ' + (ride.driverName || 'Unknown') : 'Student: ' + (ride.studentName || 'Unknown')}</div>
                    <div class="text-xs text-gray-400 mt-1">
                        <span class="text-secondary font-medium">From:</span> ${ride.route && ride.route.pickup ? ride.route.pickup : 'Campus'}<br>
                        <span class="text-primary font-medium">To:</span> ${ride.route && ride.route.dropoff ? ride.route.dropoff : 'Campus'}
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-secondary font-bold font-mono">₹${ride.price || 10}</div>
                    <div class="text-xs ${ride.status === 'completed' ? 'text-green-500' : 'text-orange-500'} font-medium capitalize">${(ride.status || 'unknown').replace('_', ' ')}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error fetching history:", err);
        list.innerHTML = '<div class="text-center text-red-500 py-8">Failed to load history.</div>';
    }
};

window.renderProfile = function() {
    document.getElementById('profile-edit-name').value = appState.profile.name;
    document.getElementById('profile-edit-phone').value = appState.profile.phone;
};

window.saveProfile = async function() {
    const newName = document.getElementById('profile-edit-name').value.trim();
    if (newName && appState.user) {
        try {
            await fetch('/api/users/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: appState.user.phone, name: newName })
            });
            appState.profile.name = newName;
            appState.user.name = newName;
            updateGlobalProfileUI();
            alert("Profile updated successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to update profile.");
        }
    }
};

function updateGlobalProfileUI() {
    // Update Header
    const greetingName = document.getElementById('user-greeting-name');
    if (greetingName) greetingName.innerText = appState.profile.name;

    // Update Drawer
    const drawerName = document.getElementById('drawer-name');
    if (drawerName) drawerName.innerText = appState.profile.name;
    const drawerPhone = document.getElementById('drawer-phone');
    if (drawerPhone) drawerPhone.innerText = appState.profile.phone;

    // Update Avatars dynamically
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(appState.profile.name)}&background=104ce4&color=fff`;
    const avatarEls = ['user-avatar', 'drawer-avatar', 'profile-edit-avatar'];
    avatarEls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = avatarUrl;
    });
}

// --- Google Maps Logic ---
window.appInitMap = function() {
    const defaultCenter = { lat: 18.4922, lng: 74.0220 }; // Center roughly between hubs
    
    const mapOptions = {
        center: defaultCenter,
        zoom: 16,
        styles: customMapStyle,
        disableDefaultUI: true,
        zoomControl: true
    };

    if (document.getElementById('student-map')) {
        document.getElementById('student-map').innerHTML = '';
        appState.maps.student = new google.maps.Map(document.getElementById('student-map'), mapOptions);
        addHubMarkers(appState.maps.student);
    }

    if (document.getElementById('driver-map')) {
        document.getElementById('driver-map').innerHTML = '';
        appState.maps.driver = new google.maps.Map(document.getElementById('driver-map'), mapOptions);
        addHubMarkers(appState.maps.driver);
    }
    
    if (Object.keys(appState.cartData).length > 0) {
        updateMapMarkers();
    }
};

if (window.mapReady) {
    window.appInitMap();
}

function addHubMarkers(mapInstance) {
    Object.entries(CAMPUS_HUBS).forEach(([name, coords]) => {
        const marker = new google.maps.Marker({
            position: coords,
            map: mapInstance,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#104ce4", // Primary Blue
                fillOpacity: 1,
                strokeWeight: 3,
                strokeColor: "#ffffff"
            },
            title: name
        });
        
        // Add a small info window for hubs
        const infoWindow = new google.maps.InfoWindow({
            content: `<div class="p-1 text-sm font-bold text-gray-800 shadow-sm">${name}</div>`
        });
        
        marker.addListener('click', () => {
            infoWindow.open(mapInstance, marker);
        });
    });
}

function updateMapMarkers() {
    if (!window.google || (!appState.maps.student && !appState.maps.driver) || !appState.user) return;
    
    const activeMap = appState.user.role === 'driver' ? appState.maps.driver : appState.maps.student;
    if (!activeMap) return;

    const currentActiveCartIds = new Set();
    
    if (!appState.maps.infoWindows) appState.maps.infoWindows = {};

    for (const [cartId, cart] of Object.entries(appState.cartData)) {
        if (cart.isOnline) {
            currentActiveCartIds.add(cartId);
            
            let driverName = "Driver";
            if (cart.driver && cart.driver.name) {
                driverName = cart.driver.name;
            }

            const infoContent = `
                <div class="bg-white p-4 w-64 rounded-2xl">
                    <div class="flex justify-between items-center mb-3">
                        <span class="bg-emerald-50 text-emerald-600 text-xs font-bold px-2 py-1 rounded-md">Live</span>
                        <span class="text-gray-400">...</span>
                    </div>
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="font-bold text-gray-900">${cartId.replace(/_/g, ' ')}</h4>
                        <img src="/assets/golf_cart.png" class="h-8 object-contain">
                    </div>
                    <div class="flex items-center mb-4">
                        <div class="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-3">
                            <img src="https://ui-avatars.com/api/?name=${driverName}&background=random" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800">${driverName}</p>
                            <p class="text-xs text-yellow-500 font-bold">★ 4.8</p>
                        </div>
                    </div>
                    <button onclick="selectCartForBooking('${cartId}')" class="w-full border-2 border-primary text-primary hover:bg-primary hover:text-white font-bold py-2 rounded-xl transition text-sm">
                        Book Ride
                    </button>
                </div>
            `;

            if (appState.maps.markers[cartId]) {
                const newPos = new google.maps.LatLng(cart.location.lat, cart.location.lng);
                appState.maps.markers[cartId].setPosition(newPos);
                if (appState.maps.infoWindows[cartId]) {
                    appState.maps.infoWindows[cartId].setContent(infoContent);
                }
            } else {
                appState.maps.markers[cartId] = new google.maps.Marker({
                    position: { lat: cart.location.lat, lng: cart.location.lng },
                    map: activeMap,
                    icon: {
                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        scale: 6,
                        fillColor: "#104ce4", 
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#ffffff",
                        rotation: 0
                    },
                    title: cartId.replace(/_/g, ' ')
                });

                const infoWindow = new google.maps.InfoWindow({ content: infoContent });
                appState.maps.infoWindows[cartId] = infoWindow;

                appState.maps.markers[cartId].addListener('click', () => {
                    // Close others
                    Object.values(appState.maps.infoWindows).forEach(iw => iw.close());
                    infoWindow.open({
                        anchor: appState.maps.markers[cartId],
                        map: activeMap,
                    });
                });
            }
        }
    }
    
    // Remove markers for offline carts
    for (const cartId in appState.maps.markers) {
        if (!currentActiveCartIds.has(cartId)) {
            appState.maps.markers[cartId].setMap(null);
            delete appState.maps.markers[cartId];
            if (appState.maps.infoWindows[cartId]) delete appState.maps.infoWindows[cartId];
        }
    }
}

// --- Firebase Auth Logic ---
function setupRecaptcha() {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {}
    });
}

function sendOTP(phoneOrEmail) {
    const isEmail = phoneOrEmail.includes('@');
    const buttons = document.querySelectorAll('button[type="submit"]');
    buttons.forEach(btn => btn.innerText = "Sending...");

    if (isEmail) {
        // Real OTP flow for Email addresses
        fetch('/api/auth/send-email-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: phoneOrEmail })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                buttons.forEach(btn => btn.innerText = "Send OTP");
                return;
            }
            appState.pendingAuthPhone = phoneOrEmail;
            document.getElementById('otp-phone-display').innerText = phoneOrEmail;
            switchAuthView('otp-view', window.currentAuthRole);
            buttons.forEach(btn => btn.innerText = "Send OTP");
        })
        .catch(err => {
            console.error(err);
            alert("Error sending email.");
            buttons.forEach(btn => btn.innerText = "Send OTP");
        });
        return;
    }

    const fullPhone = `+91${phoneOrEmail}`;
    const appVerifier = window.recaptchaVerifier;
    
    signInWithPhoneNumber(auth, fullPhone, appVerifier)
        .then((confirmationResult) => {
            window.confirmationResult = confirmationResult;
            appState.pendingAuthPhone = phoneOrEmail;
            document.getElementById('otp-phone-display').innerText = `+91 ${phoneOrEmail}`;
            switchAuthView('otp-view', window.currentAuthRole);
            buttons.forEach(btn => btn.innerText = "Send OTP");
        }).catch((error) => {
            console.error("SMS not sent", error);
            alert("Firebase Error: " + error.message);
            buttons.forEach(btn => btn.innerText = "Send OTP");
            if(window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(function(widgetId) {
                    grecaptcha.reset(widgetId);
                });
            }
        });
}

function handleSignupSendOTP(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const role = window.currentAuthRole;
    const cartId = document.getElementById('signup-cart-id') ? document.getElementById('signup-cart-id').value : null;

    const userObj = { name, phone, role, cartId: role === 'driver' ? cartId : null };
    localStorage.setItem(`user_${phone}`, JSON.stringify(userObj));
    
    sendOTP(phone);
}

function handleLoginSendOTP(e) {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    
    const userStr = localStorage.getItem(`user_${phone}`);
    if (!userStr) {
        alert('Account not found. Please sign up first.');
        return;
    }

    // Verify role matches
    const userObj = JSON.parse(userStr);
    if (userObj.role !== window.currentAuthRole) {
        alert(`This account is registered as a ${userObj.role}. Please use the correct login portal.`);
        return;
    }

    sendOTP(phone);
}

function setupOTPInputs() {
    const inputs = document.querySelectorAll('#otp-form input[type="text"]');
    inputs.forEach((input, index) => {
        input.addEventListener('keyup', (e) => {
            if (e.key >= 0 && e.key <= 9) {
                if (index < inputs.length - 1) inputs[index + 1].focus();
            } else if (e.key === 'Backspace') {
                if (index > 0) inputs[index - 1].focus();
            }
        });
    });
}

function handleVerifyOTP(e) {
    e.preventDefault();
    let code = '';
    const inputs = document.querySelectorAll('#otp-form input[type="text"]');
    inputs.forEach(input => code += input.value);

    if(code.length !== 6) {
        alert("Please enter the 6-digit code.");
        return;
    }

    const verifyBtn = document.querySelector('#otp-form button[type="submit"]');
    verifyBtn.innerText = "Verifying...";

    const phoneOrEmail = appState.pendingAuthPhone;
    const isEmail = phoneOrEmail.includes('@');

    const handleSuccess = async (result) => {
        const phone = appState.pendingAuthPhone; // stores email or phone
        const userStr = localStorage.getItem(`user_${phone}`);
        let name = "User";
        let role = window.currentAuthRole;
        let cartId = null;

        if (userStr) {
            const userObj = JSON.parse(userStr);
            name = userObj.name || name;
            role = userObj.role || role;
            cartId = userObj.cartId || cartId;
        }

        try {
            const response = await fetch('/api/users/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, name, role, cartId })
            });
            const userData = await response.json();
            
            if (userData && !userData.error) {
                appState.user = userData;
                appState.walletBalance = userData.walletBalance || 0;
                appState.walletTransactions = userData.walletTransactions || [];
                appState.rideHistory = userData.rideHistory || [];
                
                localStorage.setItem('active_session_phone', phone);
                localStorage.setItem(`user_${phone}`, JSON.stringify(userData)); // update cache
                
                transitionToMainApp();
            } else {
                alert("Error fetching profile from database.");
            }
        } catch (err) {
            console.error("Error syncing user data", err);
            alert("Login successful but failed to sync database info.");
        }
        
        verifyBtn.innerText = "Verify OTP";
        inputs.forEach(input => input.value = '');
    };

    const handleError = (error) => {
        console.error("OTP verification failed", error);
        alert("Invalid code. Please try again.");
        verifyBtn.innerText = "Verify OTP";
        inputs.forEach(input => input.value = '');
        inputs[0].focus();
    };

    if (isEmail) {
        // Verify email OTP on the backend
        fetch('/api/auth/verify-email-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: phoneOrEmail, code })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            return signInWithCustomToken(auth, data.customToken);
        })
        .then(handleSuccess)
        .catch(err => {
            alert(err.message || "Invalid OTP");
            handleError(err);
        });
    } else {
        // Phone verification
        window.confirmationResult.confirm(code)
            .then(handleSuccess)
            .catch(handleError);
    }

}

window.logout = function() {
    localStorage.removeItem('active_session_phone');
    appState.user = null;
    appState.pendingAuthPhone = null;
    
    if (appState.watchId !== null) stopLocationTracking();
    
    containers.mainApp.classList.add('hidden');
    containers.authFlow.classList.remove('hidden');
    switchAuthView('splash-view');
    
    document.getElementById('signup-form').reset();
    document.getElementById('login-form').reset();
    document.getElementById('otp-form').reset();
};

function transitionToMainApp() {
    containers.authFlow.classList.add('hidden');
    containers.mainApp.classList.remove('hidden');
    containers.mainApp.classList.add('fade-in');

    // Populate profile from verified user data
    if (appState.user) {
        appState.profile.name = appState.user.name || 'User';
        appState.profile.phone = `+91 ${appState.user.phone}`;
        updateGlobalProfileUI();
    }

    if (appState.user.role === 'student') {
        showAppView('studentDashboard');
        // Ensure student sees wallet and history
        if (document.getElementById('link-wallet')) document.getElementById('link-wallet').classList.remove('hidden');
        if (document.getElementById('link-history')) document.getElementById('link-history').classList.remove('hidden');
    } else {
        showAppView('driverDashboard');
        const driverCartDisplay = document.getElementById('driver-cart-display');
        if (driverCartDisplay) driverCartDisplay.innerText = appState.user.cartId.replace(/_/g, ' ');
        
        if (document.getElementById('link-wallet')) document.getElementById('link-wallet').classList.add('hidden');
        // Ensure drivers can see history
        if (document.getElementById('link-history')) document.getElementById('link-history').classList.remove('hidden');
    }
    
    // Update markers now that we know the user role
    updateMapMarkers();
}

// --- Cart List Logic ---
function renderCartsList() {
    const listContainer = document.getElementById('carts-list');
    if(!listContainer) return;
    
    listContainer.innerHTML = ''; 
    let hasActiveCarts = false;

    for (const [cartId, cart] of Object.entries(appState.cartData)) {
        if (cart.isOnline) {
            hasActiveCarts = true;
            let availableSeats = 0;
            for (let i = 2; i <= 6; i++) {
                if (cart.seats[i].status === 'available') availableSeats++;
            }

            const cartCard = document.createElement('div');
            cartCard.className = 'bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center shadow-sm';
            cartCard.innerHTML = `
                <div class="flex items-center">
                    <div class="bg-blue-50 text-secondary p-2 rounded-lg mr-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <div>
                        <h4 class="font-bold text-primary">${cartId.replace(/_/g, ' ')}</h4>
                        <p class="text-[13px] text-gray-500 font-medium">${availableSeats} seats available</p>
                    </div>
                </div>
                <button onclick="selectCartForBooking('${cartId}')" class="bg-primary hover:bg-primaryHover text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-md transition">
                    Book
                </button>
            `;
            listContainer.appendChild(cartCard);
        }
    }

    if (!hasActiveCarts) {
        listContainer.innerHTML = `<p class="text-gray-500 text-sm text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">No carts are currently online.</p>`;
    }
}

// --- Student Logic ---
function populateHubDropdowns() {
    const pickup = document.getElementById('pickup-hub');
    const dropoff = document.getElementById('dropoff-hub');
    
    Object.keys(CAMPUS_HUBS).forEach(hub => {
        pickup.add(new Option(hub, hub));
        dropoff.add(new Option(hub, hub));
    });
}

function handleFindCarts() {
    const pickup = document.getElementById('pickup-hub').value;
    const dropoff = document.getElementById('dropoff-hub').value;

    if (!pickup || !dropoff || pickup === dropoff) {
        alert('Please select distinct valid pickup and drop-off locations.');
        return;
    }
    
    appState.route = { pickup, dropoff };
    
    document.getElementById('available-carts-section').classList.remove('hidden');
    renderCartsList();
}

window.selectCartForBooking = function(cartId) {
    if (!appState.route.pickup) {
        alert('Please select your route first before selecting a cart.');
        return;
    }
    appState.selectedCartId = cartId;
    renderSeatGrid(cartId);
    showAppView('seatSelection');
    document.getElementById('booking-cart-name').innerText = cartId.replace(/_/g, ' ');
};

function renderSeatGrid(cartId) {
    const cart = appState.cartData[cartId];
    if (!cart) return;

    for (let i = 2; i <= 6; i++) {
        const seatEl = document.getElementById(`seat-${i}`);
        const status = cart.seats[i].status;
        
        seatEl.className = 'seat';
        
        if (status === 'available') {
            if (appState.selectedSeats.includes(i)) {
                seatEl.classList.add('selected', 'bg-primary', 'text-white', 'border-primary', 'shadow-md', 'scale-105');
            } else {
                seatEl.classList.add('available', 'bg-white', 'text-gray-700', 'border-gray-200', 'hover:border-primary', 'hover:text-primary');
            }
        } else if (status === 'pending') {
            seatEl.classList.add('pending', 'bg-yellow-100', 'text-yellow-600', 'border-yellow-300', 'opacity-80');
        } else if (status === 'occupied') {
            seatEl.classList.add('occupied', 'bg-red-100', 'text-red-500', 'border-red-200', 'opacity-60', 'cursor-not-allowed');
        }
    }
}

window.toggleSeat = function(seatNumber) {
    const cart = appState.cartData[appState.selectedCartId];
    if (cart.seats[seatNumber].status !== 'available') return;

    if (appState.selectedSeats.includes(seatNumber)) {
        appState.selectedSeats = appState.selectedSeats.filter(s => s !== seatNumber); 
    } else {
        appState.selectedSeats.push(seatNumber); 
    }
    
    const confirmBtn = document.getElementById('btn-confirm-booking');
    if (appState.selectedSeats.length > 0) {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        confirmBtn.innerText = `Request ${appState.selectedSeats.length} Seat(s)`;
    } else {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        confirmBtn.innerText = "Request Booking";
    }

    renderSeatGrid(appState.selectedCartId);
};

function handleConfirmBooking() {
    if (appState.selectedSeats.length === 0) return;

    appState.selectedSeats.forEach(seatNumber => {
        socket.emit('request-seat', {
            cartId: appState.selectedCartId,
            seatNumber: seatNumber,
            studentInfo: { name: appState.user.name, phone: appState.user.phone },
            route: appState.route
        });
    });

    document.getElementById('btn-confirm-booking').innerText = "Requesting...";
    document.getElementById('btn-confirm-booking').disabled = true;
}

// --- Driver Logic ---
function handleDutyToggle(e) {
    const isOnline = e.target.checked;
    const statusText = document.getElementById('driver-status-text');
    
    if (isOnline) {
        statusText.innerText = "Online - Ready for Rides";
        statusText.classList.remove('text-gray-400');
        statusText.classList.add('text-secondary');
        
        socket.emit('driver-online', { 
            cartId: appState.user.cartId,
            driverPhone: appState.user.phone,
            driverName: appState.user.name
        });
        startLocationTracking();
    } else {
        statusText.innerText = "Offline";
        statusText.classList.remove('text-secondary');
        statusText.classList.add('text-gray-400');
        
        socket.emit('driver-offline', { cartId: appState.user.cartId });
        stopLocationTracking();
    }
}

function startLocationTracking() {
    if (navigator.geolocation) {
        appState.watchId = navigator.geolocation.watchPosition((position) => {
            socket.emit('update-location', {
                cartId: appState.user.cartId,
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });
        }, (error) => {
            console.error("Geolocation error:", error);
        }, { enableHighAccuracy: true });
    }
}

function stopLocationTracking() {
    if (appState.watchId !== null) {
        navigator.geolocation.clearWatch(appState.watchId);
        appState.watchId = null;
    }
}

function addRideRequestCard(request) {
    const container = document.getElementById('ride-requests-container');
    const noReqText = document.getElementById('no-requests-text');
    
    if (noReqText) noReqText.classList.add('hidden');

    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4';
    card.id = `request-${request.seatNumber}`;
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div>
                <h4 class="font-bold text-gray-900">${request.studentInfo.name}</h4>
                <p class="text-xs text-gray-500 mt-1">📱 ${request.studentInfo.phone}</p>
            </div>
            <div class="bg-blue-50 text-primary text-xs font-bold px-2 py-1 rounded-md border border-blue-100">
                Seat #${request.seatNumber}
            </div>
        </div>
        <div class="mb-4 text-xs bg-gray-50 p-2 rounded-lg text-gray-700 font-medium">
            <p class="mb-1"><span class="text-secondary mr-1">●</span> ${request.route.pickup}</p>
            <p><span class="text-primary mr-1">●</span> ${request.route.dropoff}</p>
        </div>
        <div class="flex space-x-2" id="actions-${request.seatNumber}">
            <button onclick="acceptRide(${request.seatNumber}, '${request.requestId}', '${request.studentInfo.name}')" class="flex-1 bg-primary hover:bg-primaryHover text-white py-2 rounded-lg font-bold transition text-sm">Accept</button>
            <button onclick="rejectRide(${request.seatNumber}, '${request.requestId}')" class="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-2 rounded-lg font-bold transition text-sm">Reject</button>
        </div>
    `;
    container.appendChild(card);
}

window.acceptRide = function(seatNumber, requestId, studentName) {
    socket.emit('confirm-ride', {
        cartId: appState.user.cartId,
        seatNumber: seatNumber,
        requestId: requestId,
        studentInfo: { name: studentName }
    });

    const actionsDiv = document.getElementById(`actions-${seatNumber}`);
    
    // Replace Accept/Reject with OTP Input and Start button
    actionsDiv.innerHTML = `
        <div class="w-full">
            <p class="text-[10px] text-primary font-bold mb-1 uppercase tracking-wider text-center bg-blue-50 rounded p-1">1. Verify Payment &nbsp; 2. Enter Student OTP</p>
            <div class="flex space-x-2">
                <input type="text" id="driver-otp-input-${seatNumber}" placeholder="4-digit PIN" maxlength="4" class="w-2/3 border border-gray-300 rounded-lg px-3 py-2 text-center font-bold tracking-widest focus:border-primary">
                <button onclick="startRide(${seatNumber})" class="w-1/3 bg-secondary hover:bg-teal-500 text-white rounded-lg font-bold transition text-sm">Start</button>
            </div>
        </div>
    `;
};

window.startRide = function(seatNumber) {
    const otpInput = document.getElementById(`driver-otp-input-${seatNumber}`).value;
    if (otpInput.length !== 4) {
        alert("Please enter the 4-digit OTP provided by the student.");
        return;
    }

    // Send OTP to server to verify
    socket.emit('start-ride', {
        cartId: appState.user.cartId,
        seatNumber: seatNumber,
        otp: otpInput
    });
};

window.rejectRide = function(seatNumber, requestId) {
    socket.emit('reject-ride', {
        cartId: appState.user.cartId,
        seatNumber: seatNumber,
        requestId: requestId
    });
    
    const card = document.getElementById(`request-${seatNumber}`);
    if (card) card.remove();
    checkEmptyRequests();
};

window.completeRide = function(seatNumber) {
    socket.emit('complete-ride', {
        cartId: appState.user.cartId,
        seatNumber: seatNumber
    });
    
    const card = document.getElementById(`request-${seatNumber}`);
    if (card) card.remove();
    checkEmptyRequests();
};

function checkEmptyRequests() {
    const container = document.getElementById('ride-requests-container');
    if (container.children.length === 1) { 
        document.getElementById('no-requests-text').classList.remove('hidden');
    }
}

// --- Socket Listeners ---
socket.on('initial-state', (data) => {
    appState.cartData = data;
    renderCartsList();
    if (appState.selectedCartId) renderSeatGrid(appState.selectedCartId);
    updateMapMarkers();
});

socket.on('cart-state-updated', (data) => {
    appState.cartData = data;
    renderCartsList();
    if (appState.selectedCartId) renderSeatGrid(appState.selectedCartId);
    updateMapMarkers();
});

socket.on('location-updated', (data) => {
    const { cartId, lat, lng } = data;
    if (appState.cartData[cartId]) {
        appState.cartData[cartId].location = { lat, lng };
        
        // Directly update map marker to be instantly responsive
        if (appState.maps.markers[cartId] && window.google) {
            const newPos = new google.maps.LatLng(lat, lng);
            appState.maps.markers[cartId].setPosition(newPos);
            
            // If we are a driver and this is our cart, pan the map to center
            if (appState.user && appState.user.role === 'driver' && appState.user.cartId === cartId && appState.maps.driver) {
                appState.maps.driver.panTo(newPos);
            }
        }
    }
});

socket.on('seat-updated', (data) => {
    const { cartId, seatNumber, status } = data;
    if (appState.cartData[cartId]) {
        appState.cartData[cartId].seats[seatNumber].status = status;
        if (appState.selectedCartId === cartId) {
            renderSeatGrid(cartId);
        }
    }
});

// Student specific listeners
socket.on('request-accepted', (data) => {
    const btn = document.getElementById('btn-confirm-booking');
    
    // Hide seat selection and go back to dashboard
    showAppView('studentDashboard');
    
    // Show the Active Ride Modal with Payment and OTP
    const container = document.getElementById('student-ride-otps-container');
    const otpBlock = document.createElement('div');
    otpBlock.id = `active-ride-${data.seatNumber}`;
    otpBlock.className = 'bg-white/20 backdrop-blur-md rounded-xl p-3 text-center border border-white/30 flex flex-col items-center w-full';
    
    // Configurable UPI ID (Fallback to a demo UPI if not set)
    const UPI_ID = window.appConfig?.upiId || '9607783459@axl';
    const upiLink = `upi://pay?pa=${UPI_ID}&pn=Lily%20Golfcart&am=10&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;

    otpBlock.innerHTML = `
        <div class="w-full flex flex-col items-center">
            <p class="text-[11px] text-emerald-50 mb-2 font-bold uppercase tracking-widest text-center">Step 1: Pay Driver ₹10</p>
            <div class="bg-white p-2 rounded-xl mb-3 shadow-sm inline-block">
                <img src="${qrUrl}" alt="UPI QR Code" class="w-32 h-32 mx-auto rounded-lg">
            </div>
            <a href="${upiLink}" onclick="if(!/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent)){ alert('Please scan the QR code above with your phone! This button only opens UPI apps on mobile devices.'); return false; }" class="bg-white text-emerald-600 font-bold py-2 px-4 rounded-full text-xs mb-4 shadow-md flex items-center justify-center w-full max-w-[200px] hover:bg-emerald-50 transition">
                <i class="fas fa-bolt mr-2 text-yellow-500"></i> Pay ₹10 via UPI App
            </a>
            
            <div class="w-full border-t border-white/20 pt-3 mt-1">
                <p class="text-[11px] text-emerald-50 font-bold uppercase tracking-widest text-center mb-2">Step 2: Show OTP to Start Ride</p>
                <div class="flex justify-between items-center bg-black/10 rounded-lg p-2 px-4 border border-black/5">
                    <span class="text-xs text-emerald-50 font-medium uppercase tracking-wider">Seat #${data.seatNumber}</span>
                    <span class="text-3xl font-bold tracking-widest text-white font-mono">${data.rideOtp}</span>
                </div>
            </div>
        </div>
    `;
    container.appendChild(otpBlock);

    document.getElementById('student-active-ride-section').classList.remove('hidden');
    
    // Reset booking form state
    appState.selectedSeats = [];
    btn.innerText = "Request Booking";
    btn.classList.remove('bg-emerald-500', 'shadow-emerald-500/30');
    btn.classList.add('bg-primary', 'shadow-blue-500/30');
    btn.disabled = false;
});

socket.on('request-rejected', (data) => {
    alert(`Booking failed: ${data.message}`);
    const btn = document.getElementById('btn-confirm-booking');
    btn.innerText = "Request Booking";
    btn.disabled = false;
    appState.selectedSeats = [];
    if (appState.selectedCartId) renderSeatGrid(appState.selectedCartId);
});

socket.on('ride-completed', (data) => {
    // Remove the specific seat's OTP block
    const otpBlock = document.getElementById(`active-ride-${data.seatNumber}`);
    if (otpBlock) otpBlock.remove();
    
    // If no more OTPs are active, hide the container
    const container = document.getElementById('student-ride-otps-container');
    if (container && container.children.length === 0) {
        document.getElementById('student-active-ride-section').classList.add('hidden');
    }
    
    // Show the Ride Ended thank you section
    document.getElementById('student-ride-ended-section').classList.remove('hidden');
});

// Driver specific listeners
socket.on('ride-request', (data) => {
    addRideRequestCard(data);
});

socket.on('ride-started-success', (data) => {
    const { seatNumber } = data;
    const actionsDiv = document.getElementById(`actions-${seatNumber}`);
    
    if (actionsDiv) {
        actionsDiv.innerHTML = `
            <button onclick="completeRide(${seatNumber})" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-bold transition text-sm shadow-md">Complete Ride (Drop-off)</button>
        `;
    }
});

socket.on('ride-started-error', (data) => {
    alert(`OTP Verification Failed: ${data.message}. Ask the student for the correct 4-digit code.`);
});

// EOF
