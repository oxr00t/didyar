// Authentication System
let currentScale = 1;
let currentTranslateX = 0;
let currentTranslateY = 0;
let initialPinchDistance = 0;
let startScale = 1;
let lastPanX = 0;
let lastPanY = 0;
let isPanning = false;
let isZooming = false;
let camerasPerPage = 8;
let CAMERA_GROUPS = {};         
let VISIBLE_CAMERA_INDEXES = []; 
let CURRENT_GROUP_NAME = 'ALL';  
let originalVideoParent = null; 
let currentFullscreenVideo = null;
let hqVideoElement = null; // نگهدارنده ویدیوی با کیفیت بالا
let hqHlsInstance = null;  // نگهدارنده کانکشن HLS کیفیت بالا

const AUTH_CREDENTIALS = {
    username: 'admin',
    password: 'admin1234'
};

// ===============================
//  Communication Key / UUID
// ===============================

// ساخت یا دریافت UUID ثابت برای هر نام کاربری
function getUserCommunicationKey(username) {
    const storageKey = `didyarCommKey_${username}`;
    let key = localStorage.getItem(storageKey);

    if (!key) {
        if (crypto.randomUUID) {
            key = crypto.randomUUID();
        } else {
            key = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        localStorage.setItem(storageKey, key);
    }

    return key;
}
// lode data faster 
function playHLSWhenReady(videoElement, url, onReady, onError) {
if (!Hls.isSupported()) {
videoElement.src = url;
videoElement.oncanplay = () => onReady();
videoElement.onerror = () => onError && onError();
return;
}

const hls = new Hls({
    lowLatencyMode: true,
    enableWorker: true,
    backBufferLength: 0,
    maxBufferLength: 3,
});

hls.loadSource(url);
hls.attachMedia(videoElement);

let readyFired = false;
const fireReady = () => {
    if (readyFired) return;
    readyFired = true;
    onReady();
};

videoElement.oncanplay = fireReady;
videoElement.onplaying = fireReady;

hls.on(Hls.Events.MANIFEST_PARSED, () => {
    videoElement.play().catch(() => {});
});

hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal && onError) onError(data);
});

return hls;

}



// Converts "HH:MM:SS" to total seconds from midnight
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2] || 0);
}

// Converts total seconds to "HH:MM:SS" format
function secondsToTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}


// نگهداری مقدار صحیح کلید ارتباطی در حافظه
let CURRENT_COMM_KEY = null;

// قفل ورودی و جلوگیری از دستکاری دستی و DevTools
function lockCommunicationKeyField() {
    const input = document.getElementById('communication-key');
    if (!input) return;

    // همیشه فقط خواندنی
    input.readOnly = true;

    // اگر کسی از طریق JS یا DevTools readonly را برداشت، دوباره فعالش کن
    const attrObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'readonly' && !input.readOnly) {
                input.readOnly = true;
                input.value = CURRENT_COMM_KEY;
            }
        });
    });

    attrObserver.observe(input, {
        attributes: true,
        attributeFilter: ['readonly']
    });

    // اگر value را تغییر داد، سریع برگردان به مقدار واقعی
    const forceValue = () => {
        if (input.value !== CURRENT_COMM_KEY) {
            input.value = CURRENT_COMM_KEY;
        }
    };

    input.addEventListener('input', forceValue);
    input.addEventListener('change', forceValue);

    // در هر ۱ ثانیه یک بار هم چک کن (در برابر بعضی دستکاری‌ها)
    setInterval(forceValue, 1000);
}

// Utility Functions
const Utils = {
    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

function getPinchDistance(touches) {
    const touch1 = touches[0];
    const touch2 = touches[1];

    return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
    );
}

function applyFullscreenTransform() {
    // اعمال روی ویدیوی گرید
    if (currentFullscreenVideo) {
        applyTransformToElement(currentFullscreenVideo);
    }
    // اعمال روی ویدیوی کیفیت بالا (اگر هست)
    if (hqVideoElement) {
        applyTransformToElement(hqVideoElement);
    }
}

// یک تابع کمکی برای جلوگیری از تکرار کد
function applyTransformToElement(videoElement) {
    currentScale = Math.max(1, Math.min(currentScale, 5));

    if (currentScale === 1) {
        currentTranslateX = 0;
        currentTranslateY = 0;
    } else {
        const videoWidth = videoElement.clientWidth || window.innerWidth;
        const videoHeight = videoElement.clientHeight || window.innerHeight;
        const maxTranslateX = (videoWidth * (currentScale - 1)) / 2;
        const maxTranslateY = (videoHeight * (currentScale - 1)) / 2;
        currentTranslateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, currentTranslateX));
        currentTranslateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, currentTranslateY));
    }

    videoElement.style.transition = isZooming || isPanning ? 'none' : 'transform 0.3s ease-out';
    videoElement.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentScale})`;
}

// Check if user is already logged in
function checkLoginStatus() {
    const rememberLogin = localStorage.getItem('rememberLogin');
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (rememberLogin === 'true' && isLoggedIn === 'true') {
        showMainApp();
        return true;
    }
    return false;
}

// Login functionality
document.addEventListener('DOMContentLoaded', function () {
    if (!checkLoginStatus()) {
        setupLoginHandlers();
    }
});


function startRecordLoadingAndError() {
    const loader = document.getElementById('record-loader');
    const error = document.getElementById('record-error');
    if (!loader || !error) return;
    loader.style.display = 'flex';
    error.style.display = 'none';
    // 4 ثانیه لودینگ، سپس خطا
    setTimeout(() => {
        loader.style.display = 'none';
        error.textContent = 'ارتباط با سرور برقرار نشد، لطفا تنظیمات شبکه را بررسی نمایید. در صورتی که قادر به مشاهده قسمت لایو هستید، تنظیمات NAT در شبکه را بررسی نمایید.';
        error.style.display = 'block';
    }, 4000);
}


function showRegisterModal() {
    const modal = document.getElementById('register-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    const btn = document.getElementById('register-btn');
    btn.onclick = function() {
        const newUser = document.getElementById('register-username').value.trim();
        const newPass = document.getElementById('register-password').value.trim();

        // اعتبارسنجی ساده
        if (!newUser || newUser.length < 3) {
            alert('نام کاربری حداقل ۳ حرف باید باشد');
            return;
        }
        if (!newPass || newPass.length < 3) {
            alert('رمز حداقل ۳ حرف باید باشد');
            return;
        }

        // ذخیره اطلاعات جدید در localStorage
        localStorage.setItem('didyarUser_credentials',
            JSON.stringify({username: newUser, password: newPass}));

        modal.style.display = 'none';
        localStorage.setItem('isLoggedIn', 'true');
        showMainApp();
        Utils.showToast('نام کاربری و رمز جدید ثبت شد');
    };
}


function setupLoginHandlers() {
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const rememberCheckbox = document.getElementById('remember-login');
    const errorDiv = document.getElementById('login-error');

    // Handle Enter key
    [usernameInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                attemptLogin();
            }
        });
    });

    loginBtn.addEventListener('click', attemptLogin);

    function attemptLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const rememberMe = rememberCheckbox.checked;
          // ورود موفق با ادمین
    if (username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password) {
        localStorage.setItem('isLoggedIn', 'true');
        showMainApp();
        return;
    }
    // بررسی لاگین اولیه کاربر جدید
    const customCreds = JSON.parse(localStorage.getItem('didyarUser_credentials') || '{}');
    if (Object.keys(customCreds).length > 0) {
        if (username === customCreds.username && password === customCreds.password) {
            // ورود موفق با اطلاعات جدید کاربر
            localStorage.setItem('isLoggedIn', 'true');
            showMainApp();
        } else {
            errorDiv.textContent = 'نام کاربری یا رمز عبور اشتباه است!';
        }
        return;
    }

    // ورود اولیه مخصوص test/1
    if (username === 'test' && password === '1') {
        // نمایش فرم ساخت اطلاعات جدید
        showRegisterModal();
        return;
    }
        errorDiv.textContent = '';

        if (!username || !password) {
            errorDiv.textContent = 'لطفاً نام کاربری و کلمه عبور را وارد کنید';
            return;
        }

        if (username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password) {
            localStorage.setItem('isLoggedIn', 'true');

            if (rememberMe) {
                localStorage.setItem('rememberLogin', 'true');
            } else {
                localStorage.removeItem('rememberLogin');
            }

            // ذخیره نام کاربری جاری
            localStorage.setItem('currentUsername', username);

            showMainApp();
        } else {
            errorDiv.textContent = 'نام کاربری یا کلمه عبور اشتباه است!';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
}

function showMainApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    renderCachedSnapshots()

    loadSettings();
    loadCameraGroupsForUser();
    
    setupNavigation(); // Initialize sidebar navigation
    switchTab('live');
}   


function populateCameraGroupSelect() {
    const groupSelect = document.getElementById('camera-group-select');
    if (!groupSelect) return;

    const currentValue = CURRENT_GROUP_NAME || 'ALL';

    groupSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = 'همه دوربین‌ها';
    groupSelect.appendChild(allOption);

    Object.keys(CAMERA_GROUPS).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        groupSelect.appendChild(opt);
    });

    groupSelect.value = currentValue;
}

function rebuildVisibleCameraIndexes() {
    if (CURRENT_GROUP_NAME === 'ALL' || !CURRENT_GROUP_NAME) {
        VISIBLE_CAMERA_INDEXES = HLS_URLS.map((_, i) => i);
    } else {
        VISIBLE_CAMERA_INDEXES = (CAMERA_GROUPS[CURRENT_GROUP_NAME] || []).slice();
    }
}



function logout() {
    if (confirm('آیا مطمئن هستید که میخواهید خارج شوید؟')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('rememberLogin');
        localStorage.removeItem('currentUsername');

        cleanupLiveView();

        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('remember-login').checked = false;
        document.getElementById('login-error').textContent = '';

        setupLoginHandlers();
        Utils.showToast('با موفقیت خارج شدید');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.getElementById('logout-btn');
    const groupSelect = document.getElementById('camera-group-select');
    const gridSizeSelect = document.getElementById('grid-size-select');
    const addGroupBtn = document.getElementById('add-camera-group-btn');
    const deleteGroupBtn = document.getElementById('delete-camera-group-btn');
    if (gridSizeSelect) {
        const savedSize = localStorage.getItem('didyar_grid_size');
        if(savedSize) {
        gridSizeSelect.value = savedSize;
        camerasPerPage = parseInt(savedSize);
    }
        gridSizeSelect.addEventListener('change', () => {
            // تغییر تعداد دوربین در هر صفحه
            camerasPerPage = parseInt(gridSizeSelect.value, 10);
            localStorage.setItem('didyar_grid_size', camerasPerPage); // ذخیره

            
            // ریست کردن صفحه به اول
            currentPage = 0;
            
            // محاسبه مجدد تعداد کل صفحات
            totalPages = Math.ceil(VISIBLE_CAMERA_INDEXES.length / camerasPerPage);
            
            // ساخت مجدد نشانگرهای صفحه و رندر کردن
            createPageIndicators();
            renderCameraPage(currentPage);
        });
    }
    if (groupSelect) {
        groupSelect.addEventListener('change', () => {
            CURRENT_GROUP_NAME = groupSelect.value;
            rebuildVisibleCameraIndexes();
            currentPage = 0;
            totalPages = Math.ceil(VISIBLE_CAMERA_INDEXES.length / camerasPerPage);
            createPageIndicators();
            renderCameraPage(currentPage);
        });
    }

    if (addGroupBtn) {
        addGroupBtn.addEventListener('click', () => {
            const name = prompt('نام دسته جدید را وارد کنید:');
            if (!name) return;
            if (name === 'ALL') {
                alert('نام ALL رزرو شده است، نام دیگری انتخاب کنید.');
                return;
            }
            if (!CAMERA_GROUPS[name]) {
                CAMERA_GROUPS[name] = [];
                saveCameraGroupsForUser();
                populateCameraGroupSelect();
                Utils.showToast('دسته جدید اضافه شد');
            } else {
                alert('دسته‌ای با این نام وجود دارد.');
            }
        });
    }
    
    if (deleteGroupBtn) {
        deleteGroupBtn.addEventListener('click', () => {
            const name = CURRENT_GROUP_NAME;
            if (!name || name === 'ALL') {
                alert('نمیتوانید دسته "همه دوربین‌ها" را حذف کنید.');
                return;
            }
            if (!CAMERA_GROUPS[name]) {
                alert('این دسته وجود ندارد یا قبلاً حذف شده است.');
                return;
            }
            if (!confirm(`آیا از حذف دسته "${name}" مطمئن هستید؟`)) return;

            delete CAMERA_GROUPS[name];
            saveCameraGroupsForUser();

            CURRENT_GROUP_NAME = 'ALL';
            rebuildVisibleCameraIndexes();
            populateCameraGroupSelect();
            currentPage = 0;
            totalPages = Math.ceil(VISIBLE_CAMERA_INDEXES.length / 8);
            createPageIndicators();
            renderCameraPage(currentPage);

            Utils.showToast('دسته حذف شد');
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// Prevent caching
window.addEventListener('load', function () {
    if ('caches' in window) {
        caches.keys().then(function (names) {
            names.forEach(function (name) {
                caches.delete(name);
            });
        });
    }
});

// Global variables
let HLS_URLS = [];
let MHLS_URLS = [];
let currentPage = 0;
let totalPages = 0;
let touchStartX = 0;
let touchEndX = 0;
let activeHlsInstances = [];
let fullscreenVideoIndex = -1;
let fullscreenHls = null;
let isLoadingUrls = false;

// ==========================================
// Sidebar & Navigation Logic
// ==========================================
const TAB_TITLES = {
    'live': 'زنده',
    'records': 'ضبط‌ها',
    'settings': 'تنظیمات'
};

function setupNavigation() {
    const menuBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebarBtns = document.querySelectorAll('.sidebar-btn');

    // Open Menu
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        });
    }

    // Close Menu (Overlay Click)
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // Switch Tab via Sidebar
    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
            
            // Close Menu
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    });
}

function switchTab(tabName) {
    // Update Sidebar Buttons Active State
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Show/Hide Content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Update Title in Header
    const titleEl = document.getElementById('current-page-title');
    if (titleEl && TAB_TITLES[tabName]) {
        titleEl.textContent = TAB_TITLES[tabName];
    }

    // Logic per Tab
    if (tabName === 'live') {
        initializeLiveView();
    } else {
        cleanupLiveView();
    }
    
    if (tabName === 'records') {
        initPlaybackSystem();
    }
}

// Settings functionality
document.getElementById('save-settings').addEventListener('click', saveSettings);

function saveSettings() {
    const currentUsername = localStorage.getItem('currentUsername') || AUTH_CREDENTIALS.username;
    const userCommKey = getUserCommunicationKey(currentUsername);
    CURRENT_COMM_KEY = userCommKey;

    const settings = {
        serverAddress: document.getElementById('server-address').value,
        port1: document.getElementById('port1').value,
        port2: document.getElementById('port2').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        // همیشه از UUID ثابت کاربر استفاده می‌کنیم
        communicationKey: userCommKey,
        option1: document.getElementById('option1').value,
        option2: document.getElementById('option2').value,
        option3: document.getElementById('option3').value
    };

    localStorage.setItem('didyarSettings', JSON.stringify(settings));
    Utils.showToast('تنظیمات با موفقیت ذخیره شد');

    // بعد از ذخیره، دوباره ورودی را قفل کن
    document.getElementById('communication-key').value = userCommKey;
    lockCommunicationKeyField();
}

function loadSettings() {
    const savedSettings = localStorage.getItem('didyarSettings');
    const currentUsername = localStorage.getItem('currentUsername') || AUTH_CREDENTIALS.username;

    // همیشه UUID ثابت کاربر را به‌عنوان منبع حقیقت در نظر بگیر
    const userCommKey = getUserCommunicationKey(currentUsername);
    CURRENT_COMM_KEY = userCommKey;

    if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        document.getElementById('server-address').value = settings.serverAddress || '';
        document.getElementById('port1').value = settings.port1 || '';
        document.getElementById('port2').value = settings.port2 || '';
        document.getElementById('username').value = settings.username || '';
        document.getElementById('password').value = settings.password || '';

        // مقدار کلید ارتباطی همیشه همان UUID ثابت است
        document.getElementById('communication-key').value = userCommKey;

        document.getElementById('option1').value = settings.option1 || '';
        document.getElementById('option2').value = settings.option2 || '';
        document.getElementById('option3').value = settings.option3 || '';
    } else {
        // اگر تنظیمات نبود، فقط UUID را ست کن
        document.getElementById('communication-key').value = userCommKey;
    }

    // ورودی را قفل کن
    lockCommunicationKeyField();
}

// Load HLS URLs from hls.txt
async function loadHlsUrls() {
    if (isLoadingUrls) return HLS_URLS.length > 0;

    isLoadingUrls = true;
    try {
        const response = await fetch('hls.txt?t=' + Date.now());
        if (!response.ok) {
            throw new Error('Failed to load hls.txt');
        }

        const text = await response.text();
        HLS_URLS = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));

        console.log('Loaded HLS URLs:', HLS_URLS.length);
        return HLS_URLS.length > 0;
    } catch (error) {
        console.error('Error loading HLS URLs:', error);
        HLS_URLS = [];
        return false;
    } finally {
        isLoadingUrls = false;
    }
}

// Load MHLS URLs from mhls.txt
async function loadMhlsUrls() {
    try {
        const response = await fetch('mhls.txt?t=' + Date.now());
        if (!response.ok) {
            throw new Error('Failed to load mhls.txt');
        }

        const text = await response.text();
        MHLS_URLS = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));

        console.log('Loaded MHLS URLs (high quality):', MHLS_URLS.length);
        return MHLS_URLS.length > 0;
    } catch (error) {
        console.error('Error loading MHLS URLs:', error);
        console.warn('... Will use standard quality URLs for fullscreen');
        MHLS_URLS = [];
        return false;
    }
}



function getCurrentUsername() {
    // اگر قبل‌تر currentUsername را ذخیره می‌کنی از همان استفاده کن
    return localStorage.getItem('currentUsername') || AUTH_CREDENTIALS.username;
}

function loadCameraGroupsForUser() {
    const username = getCurrentUsername();
    const key = `didyarCameraGroups_${username}`;
    const raw = localStorage.getItem(key);
    if (raw) {
        try {
            CAMERA_GROUPS = JSON.parse(raw);
        } catch (e) {
            console.error('Error parsing CAMERA_GROUPS', e);
            CAMERA_GROUPS = {};
        }
    } else {
        CAMERA_GROUPS = {};
    }

    // همیشه گروه ALL را منطقی در نظر می‌گیریم ولی در ذخیره نگه نمی‌داریم
}

function saveCameraGroupsForUser() {
    const username = getCurrentUsername();
    const key = `didyarCameraGroups_${username}`;
    localStorage.setItem(key, JSON.stringify(CAMERA_GROUPS));
}



// Live view functionality
async function initializeLiveView() {
    // const container = document.getElementById('live-container');
    // container.innerHTML = '';

    if (HLS_URLS.length === 0) {
        const loaded = await loadHlsUrls();
        if (!loaded) {
            showGlobalError('خطا در بارگذاری فایل hls.txt');
            return;
        }
    }

    if (MHLS_URLS.length === 0) {
        const mhlsLoaded = await loadMhlsUrls();
        if (!mhlsLoaded) {
            MHLS_URLS = [...HLS_URLS];
            console.warn('Using standard quality URLs for fullscreen');
        }
    }
    // const container = document.getElementById('live-container');
    // container.innerHTML = ''; 
    rebuildVisibleCameraIndexes();
    populateCameraGroupSelect();
    // اگر متغیر سراسری دوربین در صفحه ذخیره شده، از آن استفاده کن
    const savedSize = localStorage.getItem('didyar_grid_size');
    if(savedSize) camerasPerPage = parseInt(savedSize);
    totalPages = Math.ceil(HLS_URLS.length / camerasPerPage);
    currentPage = 0;

    createPageIndicators();
    renderCameraPage(currentPage);
    setupSwipeGestures();
}

function renderCameraPage(pageIndex) {
    const container = document.getElementById('live-container');
    container.innerHTML = '';

    activeHlsInstances.forEach(hls => {
        if (hls) hls.destroy();
    });
    activeHlsInstances = [];

    const grid = document.createElement('div');
    grid.className = 'camera-grid';

    const list = VISIBLE_CAMERA_INDEXES && VISIBLE_CAMERA_INDEXES.length
        ? VISIBLE_CAMERA_INDEXES
        : HLS_URLS.map((_, i) => i);

    // تغییر: استفاده از camerasPerPage برای محاسبه شروع و پایان
    const startIndex = pageIndex * camerasPerPage;
    const endIndex = Math.min(startIndex + camerasPerPage, list.length);
    
    // محاسبه تعداد آیتم‌های این صفحه برای اعمال استایل خاص (تکی یا دوتایی)
    const itemsCount = endIndex - startIndex;
    
    // این خط بسیار مهم است: اگر کاربر "2 تایی" را انتخاب کرد، 
    // کلاس grid-count-2 اضافه می‌شود و CSS آن را زیر هم نمایش می‌دهد.
    grid.classList.add(`grid-count-${itemsCount}`);

    for (let i = startIndex; i < endIndex; i++) {
        const cameraIndex = list[i];
        const cameraItem = createCameraItem(cameraIndex);
        grid.appendChild(cameraItem);
    }

    container.appendChild(grid);
    updatePageIndicators();
}

function createCameraItem(index) {
    const item = document.createElement('div');
    item.className = 'camera-item';
    item.dataset.index = index;
    // ذخیره زمان ساخت برای محاسبه تاخیر (اگر نیاز بود)
    item.dataset.createdAt = Date.now().toString();

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    // مخفی کردن ویدیو تا زمانی که لود شود
    video.style.opacity = '0';

    const savedSnapshotData = localStorage.getItem(`cam_snapshot_${index}`);
    let snapshotImg = null;
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'camera-loading-container';
    
    // HTML مستقیم لودر (همان کدی که تایید کردید)
    loadingContainer.innerHTML = `
        <div class="spinner">
            <div></div><div></div><div></div><div></div><div></div><div></div>
            <div></div><div></div><div></div><div></div><div></div><div></div>
        </div>
    `;
        // ۳. منطق نمایش: اگر عکس داریم، عکس را نشان بده و لودر را مخفی کن
    if (savedSnapshotData) {
        snapshotImg = document.createElement('img');
        snapshotImg.src = savedSnapshotData;
        //snapshotImg.className = 'camera-snapshot';
        snapshotImg.className = 'snapshot-overlay';
        snapshotImg.style.position = 'absolute';
        snapshotImg.style.top = '0';
        snapshotImg.style.left = '0';
        snapshotImg.style.width = '100%';
        snapshotImg.style.height = '100%';
        snapshotImg.style.objectFit = 'cover';
        snapshotImg.style.zIndex = '5';
        // وقتی عکس داریم، لودر آبی را مخفی می‌کنیم (display: none)
        // اما آن را حذف نمی‌کنیم تا اگر عکس لود نشد یا خراب بود، لودر برگردد
        loadingContainer.style.display = 'none'; 
        item.appendChild(snapshotImg);
    }
    const label = document.createElement('div');
    label.className = 'camera-label';
    label.textContent = `CAM ${parseInt(index) + 1}`;
    
    // دکمه افزودن به گروه
    const groupBtn = document.createElement('button');
    groupBtn.className = 'camera-group-btn';
    groupBtn.textContent = '+';
    groupBtn.title = 'افزودن به دسته';
    groupBtn.addEventListener('click', () => {
        // ... (کد دکمه افزودن به گروه بدون تغییر) ...
        if (!Object.keys(CAMERA_GROUPS).length) {
            alert('هنوز هیچ دسته‌ای نساخته‌اید. از بالای صفحه دکمه "افزودن دسته جدید" را بزنید.');
            return;
        }
        const groupNames = Object.keys(CAMERA_GROUPS);
        const list = groupNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
        const choice = prompt('این دوربین را به کدام دسته اضافه کنم؟\n' + list + '\nشماره دسته را وارد کنید:');
        if (!choice) return;
        const indexNum = parseInt(choice, 10);
        if (isNaN(indexNum) || indexNum < 1 || indexNum > groupNames.length) {
            alert('شماره نامعتبر است.');
            return;
        }
        const chosenGroup = groupNames[indexNum - 1];
        const camIndex = index;
        if (!CAMERA_GROUPS[chosenGroup].includes(camIndex)) {
            CAMERA_GROUPS[chosenGroup].push(camIndex);
            saveCameraGroupsForUser();
            Utils.showToast(`دوربین به دسته "${chosenGroup}" اضافه شد`);
        } else {
            alert('این دوربین قبلاً در این دسته وجود دارد.');
        }
    });

    // دکمه حذف از گروه
    const removeBtn = document.createElement('button');
    removeBtn.className = 'camera-group-remove-btn';
    removeBtn.textContent = '🗑';
    removeBtn.title = 'حذف از این دسته';
    removeBtn.addEventListener('click', (e) => {
        // ... (کد دکمه حذف بدون تغییر) ...
        e.stopPropagation();
        const groupName = CURRENT_GROUP_NAME;
        if (!groupName || groupName === 'ALL') {
            alert('برای حذف از دسته، ابتدا یک دسته خاص انتخاب کنید.');
            return;
        }
        const list = CAMERA_GROUPS[groupName] || [];
        const idx = list.indexOf(index);
        if (idx === -1) {
            alert('این دوربین در این دسته وجود ندارد.');
            return;
        }
        if (!confirm(`این دوربین از دسته "${groupName}" حذف شود؟`)) return;

        list.splice(idx, 1);
        CAMERA_GROUPS[groupName] = list;
        saveCameraGroupsForUser();

        if (list.length === 0) {
            if (confirm(`دسته "${groupName}" خالی شده است. آن را هم حذف کنم؟`)) {
                delete CAMERA_GROUPS[groupName];
                CURRENT_GROUP_NAME = 'ALL';
            }
        }
        rebuildVisibleCameraIndexes();
        populateCameraGroupSelect();
        currentPage = 0;
        totalPages = Math.ceil(VISIBLE_CAMERA_INDEXES.length / camerasPerPage);
        createPageIndicators();
        renderCameraPage(currentPage);
        Utils.showToast('دوربین از دسته حذف شد');
    });

    label.className = 'camera-label';
    label.textContent = `CAM ${index + 1}`;

    // اضافه کردن المنت‌ها به آیتم والد
    item.appendChild(video);     // لایه زیرین
    item.appendChild(loadingContainer); // لایه رویی (کاور کننده ویدیو)
    item.appendChild(label);
    item.appendChild(groupBtn);
    item.appendChild(removeBtn);

    setupDoubleTap(item, index);
    
    // ارسال loadingFrame به تابع اتصال
    connectHLS(video, HLS_URLS[index], loadingContainer, item,snapshotImg);

    return item;
}


// حداقل زمان اضافه برای مخفی کردن لودر بعد از آماده شدن ویدیو (برای حذف فریم مشکی)
const EXTRA_HIDE_DELAY = 2000; // 300 یا 500 میلی ثانیه، به سلیقه خودت

function hideLoadingSmooth(containerElement, loadingElement) {
    if (!loadingElement || !containerElement) return;

    setTimeout(() => {
        loadingElement.style.display = 'none';
        containerElement.classList.add('video-ready');
    }, EXTRA_HIDE_DELAY);
}



// حداقل مدت نمایش لودر برای هر خانه (میلی‌ثانیه)
const MIN_LOADING_TIME = 2000;

function hideLoadingWithDelay(containerElement, loadingElement) {
    if (!loadingElement || !containerElement) return;

    const createdAt = parseInt(containerElement.dataset.createdAt || Date.now(), 10);
    const now = Date.now();
    const elapsed = now - createdAt;
    const remaining = Math.max(MIN_LOADING_TIME - elapsed, 0);

    setTimeout(() => {
        loadingElement.style.display = 'none';
        containerElement.classList.add('video-ready'); // برای افکت فیداین اگر در CSS گذاشتی
    }, remaining);
}

// ورودی پنجم (snapshotElement) اضافه شد
function connectHLS(videoElement, hlsUrl, loadingElement, containerElement, snapshotElement) {
    
    if (!Hls.isSupported()) {
        videoElement.src = hlsUrl;
        // برای سافاری و آیفون
        videoElement.onplaying = () => {
             videoElement.style.opacity = '1';
             handleSuccess(loadingElement, snapshotElement);
        };
        return;
    }

    const hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        backBufferLength: 0,
    });

    hls.loadSource(hlsUrl);
    hls.attachMedia(videoElement);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Autoplay prevented
            });
        }
    });

    // وقتی اولین فریم ویدیو رندر شد
    videoElement.onplaying = () => {
        videoElement.style.opacity = '1';
        handleSuccess(loadingElement, snapshotElement);
    };

    hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
            // در صورت خطا، اگر عکس داشتیم، همان عکس بماند بهتر از سیاهی است
            // یا می‌توانید یک آیکون خطا روی عکس نمایش دهید
            console.warn('Stream Error', data);
        }
    });

    if (activeHlsInstances) activeHlsInstances.push(hls);
    return hls;
}

// یک تابع کمکی کوچک برای تمیز کردن کد
function handleSuccess(loadingElement, snapshotElement) {
    // 1. حذف لودر
    if (loadingElement) loadingElement.remove();

    // 2. محو کردن عکس کاور
    if (snapshotElement) {
        // اضافه کردن کلاس fade-out که در CSS نوشتیم
        snapshotElement.classList.add('fade-out');
        
        // بعد از 1 ثانیه (مدت انیمیشن) عکس را کاملا از حافظه پاک کن
        setTimeout(() => {
            snapshotElement.remove();
        }, 1000);
    }
}


function showError(containerElement, message) {
    const loading = containerElement.querySelector('.camera-loading');
    if (loading) {
        loading.className = 'camera-error';
        loading.textContent = message;
        loading.style.display = 'block';
    }
}

function cleanupLiveView() {
    activeHlsInstances.forEach(hls => {
        if (hls) {
            hls.destroy();
        }
    });
    activeHlsInstances = [];

    if (fullscreenVideoIndex !== -1) {
        exitFullscreen();
    }
}

// Swipe gesture handling
function setupSwipeGestures() {
    const container = document.getElementById('live-container');

    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            currentPage++;
            if (currentPage >= totalPages) {
                currentPage = 0;
            }
            renderCameraPage(currentPage);
        } else {
            currentPage--;
            if (currentPage < 0) {
                currentPage = totalPages - 1;
            }
            renderCameraPage(currentPage);
        }
    }
}

// Page indicators
function createPageIndicators() {
    const container = document.getElementById('page-indicators');
    container.innerHTML = '';

    for (let i = 0; i < totalPages; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'page-indicator';
        if (i === 0) indicator.classList.add('active');

        indicator.addEventListener('click', () => {
            currentPage = i;
            renderCameraPage(currentPage);
        });

        container.appendChild(indicator);
    }
}

function updatePageIndicators() {
    const indicators = document.querySelectorAll('.page-indicator');

    indicators.forEach((indicator, index) => {
        if (index === currentPage) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    });
}

// Double tap for fullscreen
function setupDoubleTap(element, index) {
    let lastTap = 0;

    element.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;

        if (tapLength < 300 && tapLength > 0) {
            e.preventDefault();
            toggleFullscreen(index);
        }

        lastTap = currentTime;
    });
}



function toggleFullscreen(index) {
    const fullscreenView = document.getElementById('fullscreen-view');
    
    if (fullscreenVideoIndex !== -1) {
        exitFullscreen();
        return;
    }

    const cameraItem = document.querySelector(`.camera-item[data-index="${index}"]`);
    if (!cameraItem) return;

    const lqVideo = cameraItem.querySelector('video');
    if (!lqVideo) {
        Utils.showToast('ویدیویی برای نمایش وجود ندارد');
        return;
    }

    fullscreenVideoIndex = index;
    currentFullscreenVideo = lqVideo;
    originalVideoParent = cameraItem;

    fullscreenView.classList.add('active');
    document.body.classList.add('fullscreen-active');

    // --- مرحله ۱: تنظیمات ویدیوی گرید (لایه زیرین) ---
    fullscreenView.appendChild(lqVideo);

    lqVideo.classList.add('is-fullscreen');
    // اجبار به استفاده از ابعاد ثابت و contain
    lqVideo.style.width = '100%';
    lqVideo.style.height = '100%';
    lqVideo.style.objectFit = 'contain'; // مهم: هر دو ویدیو باید contain باشند
    lqVideo.style.transform = 'translate(0px, 0px) scale(1)';
    lqVideo.style.zIndex = '1';
    lqVideo.muted = false; 

    setupFullscreenControls();

    // --- مرحله ۲: لود کردن کیفیت بالا (لایه رویی) ---
    const highQualityUrl = MHLS_URLS[index]; 
    
    if (highQualityUrl && highQualityUrl !== lqVideo.src) {
        
        // ساخت ویدیوی کیفیت بالا
        hqVideoElement = document.createElement('video');
        hqVideoElement.className = 'hq-fullscreen-video';
        
        // استایل‌های پوزیشن
        hqVideoElement.style.position = 'absolute';
        hqVideoElement.style.top = '0';
        hqVideoElement.style.left = '0';
        hqVideoElement.style.width = '100%';
        hqVideoElement.style.height = '100%';
        hqVideoElement.style.objectFit = 'contain'; // مهم: باید دقیقاً مثل پایینی باشد
        hqVideoElement.style.zIndex = '2'; // روی ویدیوی قبلی
        
        // تنظیمات انیمیشن (Opacity)
        hqVideoElement.style.opacity = '0'; 
        hqVideoElement.style.transition = 'opacity 0.8s ease-in-out'; // انیمیشن ۸۰۰ میلی‌ثانیه‌ای نرم
        
        hqVideoElement.muted = true; // فعلا صدا قطع باشد تا اکو نشود
        hqVideoElement.autoplay = true;
        hqVideoElement.playsInline = true;

        fullscreenView.appendChild(hqVideoElement);

        hqHlsInstance = playHLSWhenReady(
            hqVideoElement,
            highQualityUrl,
            () => {
                // === وقتی کیفیت بالا آماده شد ===
                console.log('HQ Stream Ready - Starting Cross-fade');
                
                // یک تأخیر بسیار کوتاه برای اطمینان از اینکه مرورگر فریم جدید را رندر کرده
                // این جلوی "لگ" لحظه‌ای را می‌گیرد
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        // شروع فید این
                        if(hqVideoElement) hqVideoElement.style.opacity = '1';
                        
                        // انتقال صدا بعد از اتمام انیمیشن (برای جلوگیری از قطع و وصل صدا)
                        setTimeout(() => {
                            if(currentFullscreenVideo) currentFullscreenVideo.muted = true;
                            if(hqVideoElement) hqVideoElement.muted = false;
                        }, 800); // بعد از 0.8 ثانیه که تصویر کامل شد، صدا را سوییچ کن
                        
                    }, 100);
                });
            },
            (err) => {
                console.warn('HQ Stream Load Failed', err);
                if(hqVideoElement) hqVideoElement.remove();
            }
        );
    }
}
function connectFullscreenHLS(videoElement, hlsUrl, loadingElement, containerElement) {
    // loadingElement در اینجا همان iframe است

    if (Hls.isSupported()) {
        fullscreenHls = new Hls({
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
            fragLoadingTimeOut: 15000,
            manifestLoadingTimeOut: 15000,
            enableWorker: true,
            lowLatencyMode: true
        });

        fullscreenHls.loadSource(hlsUrl);
        fullscreenHls.attachMedia(videoElement);

        fullscreenHls.on(Hls.Events.MANIFEST_PARSED, function () {
            videoElement.play().catch(err => {
                console.warn('Auto-play prevented:', err);
            });
            
            // --- تغییر جدید: حذف iframe وقتی ویدیو آماده شد ---
            if (loadingElement) {
                loadingElement.style.transition = 'opacity 0.5s';
                loadingElement.style.opacity = '0';
                setTimeout(() => {
                    loadingElement.remove();
                }, 500);
            }
            // ------------------------------------------------
        });

        fullscreenHls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                // اگر خطای جدی بود، لودینگ را حذف کن تا پیام خطا دیده شود
                if (loadingElement) loadingElement.remove();

                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Fullscreen network error:', data);
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'fullscreen-error';
                        errorDiv.textContent = 'خطای شبکه - در حال تلاش مجدد...';
                        containerElement.appendChild(errorDiv);
                        
                        setTimeout(() => {
                            fullscreenHls.startLoad();
                            errorDiv.remove();
                            // اینجا دوباره لودینگ را برنمی‌گردانیم چون پیچیده می‌شود
                            // کاربر فقط پیام تلاش مجدد را می‌بیند
                        }, 2000);
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Fullscreen media error:', data);
                        fullscreenHls.recoverMediaError();
                        break;
                    default:
                        const fatalError = document.createElement('div');
                        fatalError.className = 'fullscreen-error';
                        fatalError.textContent = 'خطا در بارگذاری استریم با کیفیت بالا';
                        containerElement.appendChild(fatalError);
                        fullscreenHls.destroy();
                        break;
                }
            }
        });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // برای سافاری و iOS
        videoElement.src = hlsUrl;

        videoElement.addEventListener('loadedmetadata', () => {
            videoElement.play().catch(err => {
                console.warn('Auto-play prevented:', err);
            });
            
            // --- حذف iframe در iOS ---
            if (loadingElement) {
                loadingElement.remove();
            }
        });

        videoElement.addEventListener('error', () => {
            if (loadingElement) loadingElement.remove();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'fullscreen-error';
            errorDiv.textContent = 'خطا در بارگذاری استریم';
            containerElement.appendChild(errorDiv);
        });
    }
}

function setupFullscreenControls() {
    const closeBtn = document.getElementById('fullscreen-close');
    const fullscreenView = document.getElementById('fullscreen-view');
    const fullscreenVideo = document.getElementById('fullscreen-video');

    // متغیرهای کمکی برای مدیریت بهتر
    let isDoubleTapPending = false;
    let doubleTapTimeout = null;

    // ۱. دکمه بستن
    closeBtn.onclick = () => {
        exitFullscreen();
    };

    // ۲. مدیریت دابلتپ بهبودیافته
    let lastTap = 0;
    let lastTapTarget = null;

    fullscreenView.addEventListener('touchend', (e) => {
        // فقط اگر در حال زوم یا پن نبودیم
        if (isZooming || isPanning || e.touches.length > 0) {
            return;
        }

        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        const currentTarget = e.target;

        if (tapLength < 300 && tapLength > 0 && currentTarget === lastTapTarget) {
            e.preventDefault();
            // دابلتپ تشخیص داده شد
            if (currentScale > 1) {
                // ریست کردن زوم
                currentScale = 1;
                currentTranslateX = 0;
                currentTranslateY = 0;
                applyFullscreenTransform();
                Utils.showToast('زوم بازنشانی شد');
            }
            lastTap = 0; // ریست برای جلوگیری از تریپل تپ
        } else {
            lastTap = currentTime;
            lastTapTarget = currentTarget;
        }
    }, { passive: false });

    // ۳. رویدادهای زوم و پن بهبودیافته
    fullscreenView.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // شروع زوم
            e.preventDefault();
            isZooming = true;
            isPanning = false;
            initialPinchDistance = getPinchDistance(e.touches);
            startScale = currentScale;
        } else if (e.touches.length === 1 && currentScale > 1) {
            // شروع پن (فقط اگر زوم داریم)
            isPanning = true;
            isZooming = false;
            lastPanX = e.touches[0].clientX;
            lastPanY = e.touches[0].clientY;
        }
    }, { passive: false });

    fullscreenView.addEventListener('touchmove', (e) => {
        if (isZooming && e.touches.length === 2) {
            e.preventDefault();
            // در حال زوم
            const newPinchDistance = getPinchDistance(e.touches);
            const scaleRatio = newPinchDistance / initialPinchDistance;
            currentScale = startScale * scaleRatio;

            // محاسبه مرکز پینچ برای زوم هوشمند
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const pinchCenterX = (touch1.clientX + touch2.clientX) / 2;
            const pinchCenterY = (touch1.clientY + touch2.clientY) / 2;

            applyFullscreenTransform();
        } else if (isPanning && e.touches.length === 1) {
            e.preventDefault();
            // در حال پن
            const deltaX = e.touches[0].clientX - lastPanX;
            const deltaY = e.touches[0].clientY - lastPanY;

            currentTranslateX += deltaX;
            currentTranslateY += deltaY;

            lastPanX = e.touches[0].clientX;
            lastPanY = e.touches[0].clientY;

            applyFullscreenTransform();
        }
    }, { passive: false });

    fullscreenView.addEventListener('touchend', (e) => {
        // بررسی اتمام کامل حرکت
        if (e.touches.length === 0) {
            // همه انگشتها برداشته شدند
            if (isZooming) {
                isZooming = false;
                // اعمال محدودیتهای نهایی زوم
                applyFullscreenTransform();
            }
            if (isPanning) {
                isPanning = false;
            }
        } else if (e.touches.length === 1 && isZooming) {
            // از دو انگشت به یک انگشت تغییر کرد
            isZooming = false;
            if (currentScale > 1) {
                // شروع پن
                isPanning = true;
                lastPanX = e.touches[0].clientX;
                lastPanY = e.touches[0].clientY;
            }
        }
    }, { passive: false });

    // جلوگیری از رفتارهای پیشفرض اضافی
    fullscreenView.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });
    fullscreenView.addEventListener('gesturechange', (e) => {
        e.preventDefault();
    });
    fullscreenView.addEventListener('gestureend', (e) => {
        e.preventDefault();
    });
}


function exitFullscreen() {
    const fullscreenView = document.getElementById('fullscreen-view');
    
    if (!currentFullscreenVideo || !originalVideoParent) {
        fullscreenView.classList.remove('active');
        document.body.classList.remove('fullscreen-active');
        fullscreenVideoIndex = -1;
        return;
    }

    // 1. تمیزکاری ویدیوی کیفیت بالا (اگر وجود دارد)
    if (hqHlsInstance) {
        hqHlsInstance.destroy();
        hqHlsInstance = null;
    }
    if (hqVideoElement) {
        hqVideoElement.remove();
        hqVideoElement = null;
    }

    // 2. بازگرداندن ویدیوی گرید (کیفیت پایین) به جایگاه اصلی
    originalVideoParent.insertBefore(currentFullscreenVideo, originalVideoParent.firstChild);

    // 3. بازگرداندن تنظیمات اولیه ویدیوی گرید
    currentFullscreenVideo.classList.remove('is-fullscreen');
    currentFullscreenVideo.style.width = '100%';
    currentFullscreenVideo.style.height = '100%';
    currentFullscreenVideo.style.objectFit = 'cover';
    currentFullscreenVideo.style.transform = '';
    currentFullscreenVideo.style.zIndex = '';
    currentFullscreenVideo.muted = true; // قطع صدا در گرید

    // 4. مخفی کردن ویو
    fullscreenView.classList.remove('active');
    document.body.classList.remove('fullscreen-active');

    // 5. پاکسازی متغیرها
    currentFullscreenVideo = null;
    originalVideoParent = null;
    fullscreenVideoIndex = -1;
    
    currentScale = 1;
    currentTranslateX = 0;
    currentTranslateY = 0;
}

function showGlobalError(message) {
    const container = document.getElementById('live-container');
    container.innerHTML = `
        <div class="global-error">
            ${message}
        </div>
    `;
}

// =========================================
// PLAYBACK SYSTEM CONFIG
// =========================================
const API_BASE_URL = 'http://217.219.35.4:9026/api';
let playbackHls = null; // نگهدارنده HLS برای بخش ضبط

// 1. تابع راه‌اندازی اولیه (این را در initApp یا loginSuccess فراخوانی کنید)
function initPlaybackSystem() {
    // تنظیم تاریخ امروز به عنوان پیش‌فرض در اینپوت
    const dateInput = document.getElementById('playback-date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // دریافت لیست دوربین‌ها (تعداد)
    fetchCameraCount();

    // رویداد کلیک دکمه جستجو
    document.getElementById('search-records-btn').addEventListener('click', searchRecords);
}

// 2. دریافت تعداد دوربین‌ها و ساخت لیست کشویی
async function fetchCameraCount() {
    const select = document.getElementById('playback-camera-select');
    try {
        const response = await fetch(`http://217.219.35.4:9026/api/cameras/count`);
        if (!response.ok) throw new Error('خطا در دریافت تعداد دوربین');
        
        const count = await response.json(); // مثلا برمی‌گرداند: 63
        console.log(count)
        select.innerHTML = ''; // پاک کردن گزینه‌های قبلی
        
        // حلقه برای ساخت آپشن‌ها از 1 تا count
        for (let i = 1; i <= count; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `دوربین ${i}`;
            select.appendChild(option);
        }
    } catch (error) {
        console.error('Error fetching camera count:', error);
        select.innerHTML = '<option disabled>خطا در بارگذاری</option>';
    }
}

// Converts "HHMMSS" to "HH:MM:SS"
function formatApiTime(timeStr) {
    if (!timeStr || timeStr.length < 6) return '00:00:00';
    // Ensure the string is exactly 6 chars by padding with leading zeros if needed
    const paddedTime = timeStr.padStart(6, '0');
    return `${paddedTime.substring(0, 2)}:${paddedTime.substring(2, 4)}:${paddedTime.substring(4, 6)}`;
}


let currentRecords = []; // برای نگهداری رکوردهای روز جاری
let currentlyPlayingSegment = null; // برای نگهداری سگمنت در حال پخش

// 3. جستجوی رکوردها (تابع اصلی)
async function searchRecords() {
    const cameraIndex = document.getElementById('playback-camera-select').value;
    const date = document.getElementById('playback-date').value;
    
    const timelineSection = document.getElementById('timeline-section');
    const placeholder = document.getElementById('records-placeholder');
    const segmentsContainer = document.getElementById('timeline-segments');

    if (!cameraIndex || !date) {
        Utils.showToast('لطفاً دوربین و تاریخ را انتخاب کنید');
        return;
    }

    // نمایش پیام "در حال جستجو"
    placeholder.style.display = 'block';
    placeholder.innerHTML = '<p>در حال جستجو...</p>';
    timelineSection.style.display = 'none';
    segmentsContainer.innerHTML = ''; // پاک کردن تایم‌لاین قبلی
    currentRecords = [];

    try {
        const url = `${API_BASE_URL}/records?cameraIndex=${cameraIndex}&date=${date}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('خطا در دریافت رکوردها');

        const records = await response.json();
        currentRecords = records; // ذخیره رکوردها
        
        renderTimeline(records);

    } catch (error) {
        console.error('Search error:', error);
        placeholder.innerHTML = '<p style="color:red">خطا در ارتباط با سرور</p>';
    }
}

// 4. رندر کردن تایم‌لاین بر اساس رکوردهای دریافتی
function renderTimeline(records) {
    const segmentsContainer = document.getElementById('timeline-segments');
    const timelineSection = document.getElementById('timeline-section');
    const placeholder = document.getElementById('records-placeholder');
    
    segmentsContainer.innerHTML = '';

    if (!records || records.length === 0) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = '<p>هیچ تصویری برای این تاریخ یافت نشد.</p>';
        timelineSection.style.display = 'none';
        return;
    }
    
    const totalDaySeconds = 24 * 60 * 60;

    records.forEach(record => {
        // <<< تغییر: فرمت کردن زمان قبل از تبدیل به ثانیه
        const startTimeFormatted = formatApiTime(record.startTime);
        const endTimeFormatted = formatApiTime(record.endTime);

        const startSeconds = timeToSeconds(startTimeFormatted);
        const endSeconds = timeToSeconds(endTimeFormatted);
        
        const left = (startSeconds / totalDaySeconds) * 100;
        let width;

        // <<< تغییر: محاسبه عرض بر اساس رکوردهای عبوری از نیمه‌شب
        if (record.endDate > record.startDate || endSeconds < startSeconds) {
            // رکورد از نیمه‌شب عبور کرده
            const duration = (totalDaySeconds - startSeconds) + endSeconds;
            width = (duration / totalDaySeconds) * 100;
        } else {
            // رکورد در همان روز است
            width = ((endSeconds - startSeconds) / totalDaySeconds) * 100;
        }

        const segmentEl = document.createElement('div');
        segmentEl.className = 'timeline-segment';
        segmentEl.style.left = `${left}%`;
        segmentEl.style.width = `${width}%`;
        
        segmentEl.dataset.recordId = record.index;
        segmentEl.dataset.startTime = startTimeFormatted; // <<< تغییر: ذخیره زمان فرمت شده

        segmentsContainer.appendChild(segmentEl);
    });

    placeholder.style.display = 'none';
    timelineSection.style.display = 'block';
    
    setupTimelineInteraction();
}


// 5. افزودن رویدادها برای تعامل با تایم‌لاین
function setupTimelineInteraction() {
    const container = document.querySelector('.timeline-container');
    const tooltip = document.getElementById('timeline-tooltip');

    container.onmousemove = function(e) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width);
        const totalSeconds = Math.floor(percentage * 24 * 60 * 60);

        tooltip.style.left = `${x}px`;
        tooltip.textContent = secondsToTime(totalSeconds);
    };

    container.onclick = function(e) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width);
        const clickedSeconds = Math.floor(percentage * 24 * 60 * 60);

        // <<< تغییر: منطق پیدا کردن رکورد برای پشتیبانی از رکوردهای عبوری
        const targetRecord = currentRecords.find(record => {
            const start = timeToSeconds(formatApiTime(record.startTime));
            const end = timeToSeconds(formatApiTime(record.endTime));
            
            if (record.endDate > record.startDate || end < start) {
                // رکورد عبوری از نیمه‌شب
                return (clickedSeconds >= start && clickedSeconds < 24 * 60 * 60) || (clickedSeconds >= 0 && clickedSeconds <= end);
            } else {
                // رکورد عادی
                return clickedSeconds >= start && clickedSeconds <= end;
            }
        });

        if (targetRecord) {
            const segmentStartSeconds = timeToSeconds(formatApiTime(targetRecord.startTime));
            const seekTime = (clickedSeconds < segmentStartSeconds) 
                ? (24 * 60 * 60 - segmentStartSeconds) + clickedSeconds 
                : clickedSeconds - segmentStartSeconds;
            
            playRecordStream(targetRecord.index, seekTime);
            currentlyPlayingSegment = targetRecord;
        } else {
            Utils.showToast('در این لحظه ویدیویی ضبط نشده است.');
        }
    };
}



// 5. پخش استریم ضبط شده
function playRecordStream(recordId, seekTime = 0) {
    if (!recordId) return;

    const videoContainer = document.getElementById('playback-video-container');
    const video = document.getElementById('playback-video');
    const loading = document.getElementById('playback-loading');
    const playhead = document.getElementById('timeline-playhead');
    
    videoContainer.style.display = 'block';
    loading.style.display = 'flex';
    playhead.style.display = 'block'; // نمایش نشانگر
    
    const m3u8Url = `http://217.219.35.4:9026/api/hls/${recordId}/playlist.m3u8`;

    const hlsConfig = {
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
    };

    if (Hls.isSupported()) {
        if (window.playbackHls) {
            window.playbackHls.destroy();
        }
        
        const hls = new Hls(hlsConfig);
        window.playbackHls = hls;
        
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            loading.style.display = 'none';
            video.currentTime = seekTime; // پرش به زمان کلیک شده
            video.play().catch(() => {});
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                // ... (بخش مدیریت خطا بدون تغییر باقی بماند)
            }
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // ... (این بخش برای سافاری بدون تغییر باقی بماند، فقط currentTime اضافه شود)
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', function() {
            loading.style.display = 'none';
            video.currentTime = seekTime;
            video.play();
        });
    }

    // رویداد برای آپدیت کردن نشانگر پخش
    video.ontimeupdate = function() {
        if (!currentlyPlayingSegment) return;
        
        // <<< تغییر: استفاده از تابع فرمت‌کننده
        const segmentStartSeconds = timeToSeconds(formatApiTime(currentlyPlayingSegment.startTime));
        const currentPlaybackSeconds = segmentStartSeconds + video.currentTime;
        const totalDaySeconds = 24 * 60 * 60;
        
        // اگر ویدیو از نیمه شب رد شد، به ابتدای تایم‌لاین برگرد
        const displaySeconds = currentPlaybackSeconds % totalDaySeconds;

        const percentage = (displaySeconds / totalDaySeconds) * 100;
        playhead.style.left = `${percentage}%`;
    };
    
    // مخفی کردن نشانگر هنگام پایان پخش
    video.onended = function() {
        playhead.style.display = 'none';
        currentlyPlayingSegment = null;
    }
}
// === مدیریت اسنپ‌شات (تصویر آخرین لحظه) ===

// گرفتن عکس از ویدیو و ذخیره در حافظه
function saveSnapshot(videoElement, index) {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth < 10) return;
    try {
        const canvas = document.createElement('canvas');
        // سایز را کوچک می‌کنیم تا حافظه پر نشود (مثلا ۳۲۰ پیکسل عرض)
        const scale = 320 / videoElement.videoWidth;
        canvas.width = 320;
        canvas.height = videoElement.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const p = ctx.getImageData(0, 0, 1, 1).data; 
        if(p[0] === 0 && p[1] === 0 && p[2] === 0) {
             // اگر اولین پیکسل سیاه مطلق است، احتمال زیاد کل تصویر سیاه است، پس ذخیره نکن
             // البته ممکن است صحنه تاریک باشد، پس این شرط سلیقه‌ای است.
             // برای اطمینان بیشتر می‌توانید این ۳ خط بالا را حذف کنید.
        }
        // تبدیل به فرمت کم‌حجم WebP یا JPEG
        const dataURL = canvas.toDataURL('image/jpeg', 0.30); // کیفیت 30 درصد
        
        localStorage.setItem(`cam_snapshot_${index}`, dataURL);
    } catch (e) {
        console.warn('LocalStorage is full or error saving snapshot', e);
    }
}

// ذخیره وضعیت تمام دوربین‌های در حال پخش
function saveAllSnapshots() {
    const activeVideos = document.querySelectorAll('.camera-item video');
    activeVideos.forEach(video => {
        const parent = video.closest('.camera-item');
        if (parent && parent.dataset.index) {
            saveSnapshot(video, parent.dataset.index);
        }
    });
}

// ذخیره خودکار هنگام بسته شدن صفحه یا رفتن به تب دیگر
window.addEventListener('beforeunload', saveAllSnapshots);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveAllSnapshots();
    }
});

// این تابع را به app.js اضافه کنید
function renderCachedSnapshots() {
    const container = document.getElementById('live-container');
    container.innerHTML = ''; // پاک کردن محتوای قبلی

    // حدس می‌زنیم کاربر قبلا چندتایی دوربین داشته (مثلا ۴ یا ۸ تا)
    // یا بر اساس تعداد عکس‌های ذخیره شده در localStorage تصمیم می‌گیریم
    let maxIndex = 0;
    for(let i=0; i<64; i++) { // چک کردن تا ۶۴ دوربین
        if(localStorage.getItem(`cam_snapshot_${i}`)) maxIndex = i;
    }
    
    const countToShow = maxIndex > 0 ? maxIndex + 1 : 4; // حداقل ۴ تا نشان بده
    
    // تنظیم گرید
    const grid = document.createElement('div');
    grid.className = 'camera-grid';
    
    // تنظیم کلاس تعداد (برای ۴ تایی پیش‌فرض)
    // اگر بخواهیم دقیق‌تر باشیم باید آخرین گرید سایز کاربر را هم ذخیره می‌کردیم
    // فعلا پیش‌فرض ۴ یا تعداد عکس‌ها را می‌گذاریم
    let gridCount = 4; 
    if(countToShow <= 1) gridCount = 1;
    else if(countToShow <= 2) gridCount = 2;
    else if(countToShow <= 4) gridCount = 4;
    else gridCount = countToShow;

    grid.classList.add(`grid-count-${camerasPerPage || 4}`); // استفاده از متغیر سراسری اگر موجود بود

    // ساخت سریع آیتم‌ها فقط با عکس (بدون ویدیو و HLS)
    const startIndex = currentPage * (camerasPerPage || 4);
    const endIndex = startIndex + (camerasPerPage || 4);

    for (let i = startIndex; i < endIndex; i++) {
        const item = document.createElement('div');
        item.className = 'camera-item';
        
        const savedSnapshot = localStorage.getItem(`cam_snapshot_${i}`);
        if (savedSnapshot) {
            const img = document.createElement('img');
            img.src = savedSnapshot;
            img.className = 'camera-snapshot-placeholder'; // کلاس موقت
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            item.appendChild(img);
        } else {
            // اگر عکسی نبود، حداقل یک باکس خالی یا آبی نباشد، لودر بگذاریم؟
            // طبق خواسته شما، بهتر است چیزی نشان ندهیم یا یک آیکون دوربین بگذاریم
            // فعلا همان آبی می‌ماند چون عکسی نیست
        }
        
        grid.appendChild(item);
    }
    
    container.appendChild(grid);
}
