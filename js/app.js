/**
 * ВИК Контроль - Main Application
 */

// ===== State =====
const state = {
    currentUser: null,
    currentView: 'records',
    records: [],
    pagination: { page: 1, limit: 10, total: 0 },
    filters: {},
    dictionaries: {
        materials: [],
        operations: [],
        defect_types: [],
    },
    editingRecord: null,
};

// ===== DOM Elements =====
const elements = {};

// ===== Theme Management =====
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.textContent = theme === 'light' ? '🌙' : '☀️';
        btn.title = theme === 'light' ? 'Тёмная тема' : 'Светлая тема';
    }
}

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    bindEvents();
    initTheme();
    
    // Initially hide admin buttons until we check role
    elements.nav.admin?.classList.add('hidden');
    document.getElementById('header-admin-btn')?.classList.add('hidden');
    
    // Check auth
    if (api.isAuthenticated()) {
        state.currentUser = api.getUser();
        await initApp();
    } else {
        showView('login');
    }
});

function cacheElements() {
    // Views
    elements.views = {
        login: document.getElementById('login-view'),
        records: document.getElementById('records-view'),
        recordForm: document.getElementById('record-form-view'),
        admin: document.getElementById('admin-view'),
    };
    
    // Navigation
    elements.nav = {
        records: document.getElementById('nav-records'),
        add: document.getElementById('nav-add'),
        admin: document.getElementById('nav-admin'),
    };
    
    // Login
    elements.loginForm = document.getElementById('login-form');
    elements.loginError = document.getElementById('login-error');
    
    // Header & User
    elements.appHeader = document.getElementById('app-header');
    elements.userName = document.getElementById('user-name');
    elements.logoutBtn = document.getElementById('logout-btn');
    
    // Records
    elements.recordsList = document.getElementById('records-list');
    elements.pagination = document.getElementById('pagination');
    elements.pageInfo = document.getElementById('page-info');
    elements.prevPage = document.getElementById('prev-page');
    elements.nextPage = document.getElementById('next-page');
    
    // Filters
    elements.filters = {
        dateFrom: document.getElementById('filter-date-from'),
        dateTo: document.getElementById('filter-date-to'),
        order: document.getElementById('filter-order'),
        material: document.getElementById('filter-material'),
        apply: document.getElementById('apply-filters'),
        clear: document.getElementById('clear-filters'),
    };
    
    // Stats
    elements.statTotal = document.getElementById('stat-total');
    elements.statDefects = document.getElementById('stat-defects');
    
    // Record Form
    elements.recordForm = document.getElementById('record-form');
    elements.formTitle = document.getElementById('form-title');
    elements.backToList = document.getElementById('back-to-list');
    elements.cancelForm = document.getElementById('cancel-form');
    elements.formError = document.getElementById('form-error');
    
    // Form fields
    elements.formFields = {
        id: document.getElementById('record-id'),
        date: document.getElementById('rec-date'),
        order: document.getElementById('rec-order'),
        diameter: document.getElementById('rec-diameter'),
        thickness: document.getElementById('rec-thickness'),
        bottom: document.getElementById('rec-bottom'),
        material: document.getElementById('rec-material'),
        operation: document.getElementById('rec-operation'),
        defectType: document.getElementById('rec-defect-type'),
        defectLength: document.getElementById('rec-defect-length'),
        defectCount: document.getElementById('rec-defect-count'),
        inspector: document.getElementById('rec-inspector'),
        comments: document.getElementById('rec-comments'),
    };
    
    // Admin
    elements.adminTabs = document.querySelectorAll('.admin-tab');
    elements.adminContents = document.querySelectorAll('.admin-content');
    elements.dictTabs = document.querySelectorAll('.dict-tab');
}

function bindEvents() {
    // Login
    elements.loginForm?.addEventListener('submit', handleLogin);
    
    // Logout
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // Navigation
    elements.nav.records?.addEventListener('click', () => showView('records'));
    elements.nav.add?.addEventListener('click', () => showRecordForm());
    elements.nav.admin?.addEventListener('click', () => showView('admin'));
    
    // Header buttons (for desktop)
    document.getElementById('header-add-btn')?.addEventListener('click', () => showRecordForm());
    document.getElementById('header-admin-btn')?.addEventListener('click', () => showView('admin'));
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    
    // Filters
    elements.filters.apply?.addEventListener('click', applyFilters);
    elements.filters.clear?.addEventListener('click', clearFilters);
    
    // Pagination
    elements.prevPage?.addEventListener('click', () => changePage(-1));
    elements.nextPage?.addEventListener('click', () => changePage(1));
    
    // Record Form
    elements.backToList?.addEventListener('click', () => showView('records'));
    elements.cancelForm?.addEventListener('click', () => showView('records'));
    elements.recordForm?.addEventListener('submit', handleSaveRecord);
    
    // Admin Tabs
    elements.adminTabs.forEach(tab => {
        tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
    });
    
    // Dict Tabs
    elements.dictTabs.forEach(tab => {
        tab.addEventListener('click', () => switchDictTab(tab.dataset.dict));
    });
}

// ===== Auth =====

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    elements.loginError.textContent = '';
    
    try {
        const result = await api.login(username, password);
        state.currentUser = result.user;
        await initApp();
    } catch (err) {
        elements.loginError.textContent = err.message || 'Ошибка входа';
    }
}

async function handleLogout() {
    await api.logout();
    state.currentUser = null;
    elements.userName.textContent = '';
    sessionStorage.removeItem('vik_dicts');
    // Hide admin buttons on logout
    elements.nav.admin?.classList.add('hidden');
    document.getElementById('header-admin-btn')?.classList.add('hidden');
    showView('login');
}

// ===== App Init =====

async function initApp() {
    // Update UI - показываем логин вместо ФИО
    elements.userName.textContent = state.currentUser.username;
    
    // Show navigation buttons (ensure they're visible)
    elements.nav.records?.classList.remove('hidden');
    elements.nav.add?.classList.remove('hidden');
    
    // Show admin buttons only for admins (explicit check)
    const isAdmin = state.currentUser && state.currentUser.role === 'admin';
    if (isAdmin) {
        elements.nav.admin?.classList.remove('hidden');
        document.getElementById('header-admin-btn')?.classList.remove('hidden');
    } else {
        // Hide admin buttons for non-admins
        elements.nav.admin?.classList.add('hidden');
        document.getElementById('header-admin-btn')?.classList.add('hidden');
    }
    
    // Load dictionaries
    await loadDictionaries();
    
    // Load records
    await loadRecords();
    
    // Show records view
    showView('records');
}

async function loadDictionaries() {
    const cacheKey = 'vik_dicts';
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        const parsed = JSON.parse(cached);
        state.dictionaries.materials = parsed.materials;
        state.dictionaries.operations = parsed.operations;
        state.dictionaries.defect_types = parsed.defect_types;
        populateSelect(elements.filters.material, state.dictionaries.materials);
        populateSelect(elements.formFields.material, state.dictionaries.materials);
        populateSelect(elements.formFields.operation, state.dictionaries.operations);
        populateSelect(elements.formFields.defectType, state.dictionaries.defect_types);
        return;
    }
    
    try {
        const [materials, operations, defectTypes] = await Promise.all([
            api.getDict('materials'),
            api.getDict('operations'),
            api.getDict('defect_types'),
        ]);
        
        state.dictionaries.materials = materials.items;
        state.dictionaries.operations = operations.items;
        state.dictionaries.defect_types = defectTypes.items;
        
        // Populate selects
        populateSelect(elements.filters.material, state.dictionaries.materials);
        populateSelect(elements.formFields.material, state.dictionaries.materials);
        populateSelect(elements.formFields.operation, state.dictionaries.operations);
        populateSelect(elements.formFields.defectType, state.dictionaries.defect_types);
        
        sessionStorage.setItem(cacheKey, JSON.stringify({
            materials: materials.items,
            operations: operations.items,
            defect_types: defectTypes.items
        }));
    } catch (err) {
        console.error('Failed to load dictionaries:', err);
    }
}

function populateSelect(select, items) {
    if (!select) return;
    
    // Keep first option
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);
    
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        select.appendChild(option);
    });
}

// ===== Navigation & Views =====

function showView(viewName) {
    // Hide/show header for login view
    if (elements.appHeader) {
        if (viewName === 'login') {
            elements.appHeader.classList.add('hidden');
        } else {
            elements.appHeader.classList.remove('hidden');
        }
    }
    
    // Hide all views
    Object.values(elements.views).forEach(el => el?.classList.add('hidden'));
    
    // Show target view
    if (elements.views[viewName]) {
        elements.views[viewName].classList.remove('hidden');
    }
    
    // Update nav
    Object.values(elements.nav).forEach(el => el?.classList.remove('active'));
    
    if (viewName === 'records') {
        elements.nav.records?.classList.add('active');
    } else if (viewName === 'admin') {
        elements.nav.admin?.classList.add('active');
        loadAdminData();
    }
    
    state.currentView = viewName;
}

// ===== Records =====

async function loadRecords() {
    try {
        elements.recordsList.innerHTML = '<div class="loading">Загрузка...</div>';
        
        const params = {
            page: state.pagination.page,
            limit: state.pagination.limit,
            ...state.filters,
        };
        
        const data = await api.getRecords(params);
        
        state.records = data.records;
        state.pagination = data.pagination;
        
        renderRecords();
        updatePagination();
        updateStats();
    } catch (err) {
        elements.recordsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Ошибка загрузки данных</p>
                <button class="btn btn-secondary retry-load-btn">Повторить</button>
            </div>
        `;
    }
}

function renderRecords() {
    if (state.records.length === 0) {
        elements.recordsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>Нет записей</p>
                <button class="btn btn-primary add-record-btn">Добавить запись</button>
            </div>
        `;
        return;
    }
    
    elements.recordsList.innerHTML = state.records.map(record => `
        <div class="record-card" data-record-id="${record.id}">
            <div class="record-header">
                <span class="record-order">${escapeHtml(record.order_number)}</span>
                <span class="record-date">${formatDate(record.date)}</span>
            </div>
            <div class="record-body">
                <div class="record-row" style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; margin-top:4px;">
                    ${record.material_name ? `<span>📦 ${escapeHtml(record.material_name)}</span>` : ''}
                    ${record.operation_name ? `<span>⚙️ ${escapeHtml(record.operation_name)}</span>` : ''}
                </div>
                <div class="record-row" style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; margin-top:4px; color:#555;">
                    ${record.diameter ? `<span>⌀ ${record.diameter} мм</span>` : ''}
                    ${record.thickness ? `<span>📏 ${record.thickness} мм</span>` : ''}
                    ${record.bottom_number ? `<span>🔢 днище ${escapeHtml(record.bottom_number)}</span>` : ''}
                </div>
                ${record.defect_type_name ? `
                    <div class="record-row" style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; margin-top:6px; color:#c62828;">
                        <span>⚠️ ${escapeHtml(record.defect_type_name)}</span>
                        ${record.defect_length ? `<span>📐 ${record.defect_length} мм</span>` : ''}
                        <span>🔢 ${record.defect_count || 1} шт</span>
                    </div>
                ` : ''}
                ${record.inspector ? `<div class="record-row" style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; margin-top:4px; color:#555;"><span>👤 ${escapeHtml(record.inspector)}</span></div>` : ''}
                ${record.comments ? `<div class="record-row" style="display:flex; gap:12px; flex-wrap:wrap; font-size:13px; margin-top:4px; color:#666; font-style:italic;"><span>💬 ${escapeHtml(record.comments)}</span></div>` : ''}
            </div>
        </div>
    `).join('');
}

function updatePagination() {
    elements.pageInfo.textContent = `Страница ${state.pagination.page} из ${state.pagination.totalPages}`;
    elements.prevPage.disabled = state.pagination.page <= 1;
    elements.nextPage.disabled = state.pagination.page >= state.pagination.totalPages;
}

async function updateStats() {
    try {
        const stats = await api.getStats(state.filters);
        elements.statTotal.textContent = stats.summary.totalRecords || 0;
        elements.statDefects.textContent = stats.summary.totalDefects || 0;
    } catch (err) {
        console.error('Stats error:', err);
    }
}

function changePage(delta) {
    const newPage = state.pagination.page + delta;
    if (newPage >= 1 && newPage <= state.pagination.totalPages) {
        state.pagination.page = newPage;
        loadRecords();
    }
}

function applyFilters() {
    state.filters = {
        dateFrom: elements.filters.dateFrom.value,
        dateTo: elements.filters.dateTo.value,
        orderNumber: elements.filters.order.value,
        material: elements.filters.material.value,
    };
    state.pagination.page = 1;
    loadRecords();
}

function clearFilters() {
    elements.filters.dateFrom.value = '';
    elements.filters.dateTo.value = '';
    elements.filters.order.value = '';
    elements.filters.material.value = '';
    state.filters = {};
    state.pagination.page = 1;
    loadRecords();
}

// ===== Record Form =====

function showRecordForm(record = null) {
    state.editingRecord = record;
    elements.formTitle.textContent = record ? 'Редактирование' : 'Новая запись';
    elements.formError.textContent = '';
    
    // Set default date for new records
    const today = new Date().toISOString().split('T')[0];
    
    // Для новой записи подставляем ФИО текущего пользователя
    const currentUserName = state.currentUser?.fullName || state.currentUser?.username || '';
    const inspectorName = record ? (record.inspector || '') : currentUserName;
    
    // Fill form
    elements.formFields.id.value = record?.id || '';
    elements.formFields.date.value = record?.date || today;
    elements.formFields.order.value = record?.order_number || '';
    elements.formFields.diameter.value = record?.diameter || '';
    elements.formFields.thickness.value = record?.thickness || '';
    elements.formFields.bottom.value = record?.bottom_number || '';
    elements.formFields.material.value = record?.material_name || '';
    elements.formFields.operation.value = record?.operation_name || '';
    elements.formFields.defectType.value = record?.defect_type_name || '';
    elements.formFields.defectLength.value = record?.defect_length || '';
    elements.formFields.defectCount.value = record?.defect_count || 1;
    elements.formFields.inspector.value = inspectorName;
    elements.formFields.comments.value = record?.comments || '';
    
    // Управление секцией удаления
    const deleteSection = document.getElementById('delete-section');
    const deleteBtn = document.getElementById('delete-record-btn');
    if (deleteSection && deleteBtn) {
        if (record && canDeleteRecord(record)) {
            deleteSection.classList.remove('hidden');
            deleteBtn.onclick = () => {
                deleteRecord(record.id);
            };
        } else {
            deleteSection.classList.add('hidden');
            deleteBtn.onclick = null;
        }
    }
    
    showView('recordForm');
}

function editRecord(id) {
    const record = state.records.find(r => r.id === id);
    if (record) {
        showRecordForm(record);
    }
}

async function handleSaveRecord(e) {
    e.preventDefault();
    elements.formError.textContent = '';
    
    const data = {
        date: elements.formFields.date.value,
        orderNumber: elements.formFields.order.value,
        diameter: parseFloat(elements.formFields.diameter.value) || null,
        thickness: parseFloat(elements.formFields.thickness.value) || null,
        bottomNumber: elements.formFields.bottom.value || null,
        materialName: elements.formFields.material.value || null,
        operationName: elements.formFields.operation.value || null,
        defectTypeName: elements.formFields.defectType.value || null,
        defectLength: parseFloat(elements.formFields.defectLength.value) || null,
        defectCount: parseInt(elements.formFields.defectCount.value) || 1,
        inspector: elements.formFields.inspector.value || null,
        comments: elements.formFields.comments.value || null,
    };
    
    try {
        if (state.editingRecord) {
            await api.updateRecord(state.editingRecord.id, data);
            showToast('Запись обновлена', 'success');
        } else {
            await api.createRecord(data);
            showToast('Запись создана', 'success');
        }
        
        showView('records');
        loadRecords();
    } catch (err) {
        if (err.message === 'OFFLINE') {
            showView('records');
            return;
        }
        elements.formError.textContent = err.message || 'Ошибка сохранения';
    }
}

// ===== Admin =====

function switchAdminTab(tab) {
    elements.adminTabs.forEach(t => t.classList.remove('active'));
    elements.adminContents.forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`admin-${tab}`)?.classList.add('active');
    
    if (tab === 'users') loadUsers();
    else if (tab === 'dictionaries') loadDictionary('materials');
    else if (tab === 'schema') loadSchema();
    else if (tab === 'audit') loadAudit();
}

function switchDictTab(dict) {
    elements.dictTabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`.dict-tab[data-dict="${dict}"]`)?.classList.add('active');
    loadDictionary(dict);
}

async function loadAdminData() {
    switchAdminTab('users');
}

async function clearDatabase() {
    if (!confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ записи из базы данных!\n\nВы уверены?')) return;
    if (!confirm('Подтвердите ещё раз. Все записи будут безвозвратно удалены.')) return;
    
    try {
        const result = await api.clearDatabase();
        showToast(`Удалено ${result.deletedCount} записей`, 'success');
        // Reload records if on records view
        if (state.currentView === 'records') {
            loadRecords();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function exportCSV() {
    try {
        await api.exportCSV();
        showToast('Экспорт завершён', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
        showToast('Выберите CSV файл', 'error');
        return;
    }
    
    if (!confirm(`Импортировать файл "${file.name}"?\n\nСуществующие записи не будут удалены.`)) {
        e.target.value = '';
        return;
    }
    
    try {
        const result = await api.importCSV(file);
        showToast(`Импортировано ${result.imported} записей`, 'success');
        loadRecords();
    } catch (err) {
        showToast(err.message, 'error');
    }
    
    e.target.value = '';
}

// Users
async function loadUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const data = await api.getUsers();
        
        container.innerHTML = data.users.map(user => `
            <div class="admin-list-item">
                <div class="admin-list-info">
                    <h4>${escapeHtml(user.username)} ${user.is_active ? '' : '(деактивирован)'}</h4>
                    <p>Роль: ${user.role === 'admin' ? 'Администратор' : 'Оператор'} | 
                       ${user.full_name || 'Без ФИО'} | 
                       Последний вход: ${user.last_login ? formatDateTime(user.last_login) : 'никогда'}</p>
                </div>
                <div class="admin-list-actions">
                    <button class="btn btn-sm btn-secondary edit-user-btn" data-user-id="${user.id}">✏️</button>
                    ${user.id !== state.currentUser.id ? `
                        <button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${user.id}">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<div class="error-message">Ошибка загрузки</div>';
    }
}

// Dictionary
async function loadDictionary(type) {
    const container = document.getElementById('dict-list');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const data = await api.getDict(type);
        
        container.innerHTML = data.items.map(item => `
            <div class="admin-list-item">
                <div class="admin-list-info">
                    <h4>${escapeHtml(item.name)} ${item.is_active ? '' : '(неактивно)'}</h4>
                    <p>${item.code ? `Код: ${item.code} | ` : ''}${item.category || ''}</p>
                </div>
                <div class="admin-list-actions">
                    <button class="btn btn-sm btn-secondary edit-dict-btn" data-dict="${type}" data-id="${item.id}">✏️</button>
                    <button class="btn btn-sm btn-danger delete-dict-btn" data-dict="${type}" data-id="${item.id}">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<div class="error-message">Ошибка загрузки</div>';
    }
}

// Schema
async function loadSchema() {
    const container = document.getElementById('schema-list');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const data = await api.getSchemaTable('records');
        
        // Русские названия для стандартных полей
        const fieldLabels = {
            'id': 'ID',
            'date': 'Дата',
            'order_number': 'Номер заказа',
            'diameter': 'Диаметр',
            'thickness': 'Толщина',
            'bottom_number': 'Номер днища',
            'material_id': 'Материал (ID)',
            'operation_id': 'Технологическая операция (ID)',
            'defect_type_id': 'Вид дефекта (ID)',
            'defect_length': 'Протяженность дефекта',
            'defect_count': 'Количество дефектов',
            'inspector': 'Контроль выполнил',
            'comments': 'Комментарии',
            'created_by': 'Создано пользователем',
            'created_at': 'Дата создания',
            'updated_at': 'Дата обновления',
            'is_deleted': 'Удалено'
        };
        
        container.innerHTML = `
            <div style="padding: 16px;">
                <h4>📋 Стандартные поля (все колонки из CSV)</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Поле в БД</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Название</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Тип</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Обязательное</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.standardFields.filter(f => !f.name.startsWith('_')).map(f => `
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">${f.name}</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${fieldLabels[f.name] || f.name}</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #eee;"><span class="badge">${f.type}</span></td>
                                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${f.notNull ? '✅' : '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <h4 style="margin-top: 32px;">➕ Пользовательские поля</h4>
                ${data.customFields.length === 0 ? '<p style="color: #666; padding: 16px; background: #f5f5f5; border-radius: 8px;">Нет пользовательских полей. Нажмите "Добавить поле" чтобы создать.</p>' : ''}
                ${data.customFields.map(f => `
                    <div class="admin-list-item" style="margin-top: 8px;">
                        <div class="admin-list-info">
                            <h4>${f.field_label} <small style="color: #666;">(${f.field_name}: ${f.field_type})</small></h4>
                            <p>${f.is_required ? '✅ Обязательное' : 'Необязательное'}</p>
                        </div>
                        <div class="admin-list-actions">
                            <button class="btn btn-sm btn-danger delete-field-btn" data-field-id="${f.id}">🗑️ Удалить</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        container.innerHTML = '<div class="error-message">Ошибка загрузки</div>';
    }
}

// Audit
async function loadAudit() {
    const container = document.getElementById('audit-list');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
        const data = await api.getAudit({ limit: 50 });
        
        container.innerHTML = data.logs.map(log => `
            <div class="admin-list-item">
                <div class="audit-header">
                    <span class="audit-action ${log.action}">${log.action}</span>
                    <strong>${escapeHtml(log.username || 'система')}</strong>
                    <span class="audit-meta">${formatDateTime(log.timestamp)}</span>
                </div>
                <div class="audit-details">
                    ${log.table_name ? `Таблица: ${log.table_name}` : ''}
                    ${log.record_id ? ` | ID: ${log.record_id}` : ''}
                    ${log.success ? '' : ' | ❌ Ошибка'}
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<div class="error-message">Ошибка загрузки</div>';
    }
}

// ===== Delete Record Helper =====
function canDeleteRecord(record) {
    if (!state.currentUser) return false;
    // Admin can delete any record
    if (state.currentUser.role === 'admin') return true;
    // Operator can delete only their own records
    return record.created_by === state.currentUser.id;
}

async function deleteRecord(id) {
    if (!confirm('Удалить эту запись?')) return;
    
    try {
        await api.deleteRecord(id);
        showToast('Запись удалена', 'success');
        // Return to records list and reload
        showView('records');
        loadRecords();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===== Schema / Custom Fields Management =====

function showAddFieldModal() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="add-field-form">
            <div class="form-group">
                <label>Таблица</label>
                <select id="field-table" class="form-control">
                    <option value="records">Записи несоответствий</option>
                </select>
            </div>
            <div class="form-group">
                <label>Имя поля (латиницей, snake_case)</label>
                <input type="text" id="field-name" required placeholder="например: customer_name">
            </div>
            <div class="form-group">
                <label>Название поля (русское)</label>
                <input type="text" id="field-label" required placeholder="например: Заказчик">
            </div>
            <div class="form-group">
                <label>Тип поля</label>
                <select id="field-type">
                    <option value="TEXT">Текст</option>
                    <option value="INTEGER">Целое число</option>
                    <option value="REAL">Дробное число</option>
                    <option value="BOOLEAN">Да/Нет</option>
                    <option value="DATE">Дата</option>
                </select>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="field-required"> Обязательное поле
                </label>
            </div>
            <div class="form-group">
                <label>Значение по умолчанию</label>
                <input type="text" id="field-default" placeholder="(опционально)">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary modal-cancel-btn">Отмена</button>
                <button type="submit" class="btn btn-primary">Добавить поле</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = '➕ Добавить поле';
    showModal();
    
    document.getElementById('add-field-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            tableName: document.getElementById('field-table').value,
            fieldName: document.getElementById('field-name').value,
            fieldLabel: document.getElementById('field-label').value,
            fieldType: document.getElementById('field-type').value,
            isRequired: document.getElementById('field-required').checked,
            defaultValue: document.getElementById('field-default').value || null,
        };
        
        try {
            await api.createField(data);
            showToast('Поле добавлено', 'success');
            closeModal();
            loadSchema();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function deleteField(id) {
    if (!confirm('Удалить поле? Данные в этом поле будут потеряны.')) return;
    
    try {
        await api.deleteField(id);
        showToast('Поле удалено', 'success');
        loadSchema();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===== Users Management =====

function showAddUserModal() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="add-user-form">
            <div class="form-group">
                <label>Логин *</label>
                <input type="text" id="user-username" required minlength="3">
            </div>
            <div class="form-group">
                <label>Пароль *</label>
                <input type="password" id="user-password" required minlength="8">
                <small>Минимум 8 символов</small>
            </div>
            <div class="form-group">
                <label>Роль *</label>
                <select id="user-role" required>
                    <option value="operator">Оператор</option>
                    <option value="admin">Администратор</option>
                </select>
            </div>
            <div class="form-group">
                <label>ФИО</label>
                <input type="text" id="user-fullname" placeholder="Иванов И.И.">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary modal-cancel-btn">Отмена</button>
                <button type="submit" class="btn btn-primary">Создать</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = '➕ Добавить пользователя';
    showModal();
    
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            username: document.getElementById('user-username').value,
            password: document.getElementById('user-password').value,
            role: document.getElementById('user-role').value,
            fullName: document.getElementById('user-fullname').value,
        };
        
        try {
            await api.createUser(data);
            showToast('Пользователь создан', 'success');
            closeModal();
            loadUsers();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function editUser(id) {
    // Загружаем данные пользователя
    try {
        const { user } = await api.getUser(id);
        
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <form id="edit-user-form">
                <div class="form-group">
                    <label>Логин</label>
                    <input type="text" value="${escapeHtml(user.username)}" disabled>
                </div>
                <div class="form-group">
                    <label>Роль</label>
                    <select id="edit-user-role">
                        <option value="operator" ${user.role === 'operator' ? 'selected' : ''}>Оператор</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>ФИО</label>
                    <input type="text" id="edit-user-fullname" value="${escapeHtml(user.full_name || '')}">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="edit-user-active" ${user.is_active ? 'checked' : ''}> Активен
                    </label>
                </div>
                <hr>
                <div class="form-group">
                    <label>Новый пароль (оставьте пустым чтобы не менять)</label>
                    <input type="password" id="edit-user-password" minlength="8">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary modal-cancel-btn">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
        
        document.getElementById('modal-title').textContent = '✏️ Редактировать пользователя';
        showModal();
        
        document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                role: document.getElementById('edit-user-role').value,
                fullName: document.getElementById('edit-user-fullname').value,
                isActive: document.getElementById('edit-user-active').checked,
            };
            
            try {
                await api.updateUser(id, data);
                
                const newPassword = document.getElementById('edit-user-password').value;
                if (newPassword) {
                    await api.resetUserPassword(id, newPassword);
                }
                
                showToast('Пользователь обновлён', 'success');
                closeModal();
                loadUsers();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    } catch (err) {
        showToast('Ошибка загрузки пользователя', 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Деактивировать пользователя?')) return;
    
    try {
        await api.deleteUser(id);
        showToast('Пользователь деактивирован', 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===== Dictionary Management =====

function showAddDictItemModal() {
    const activeTab = document.querySelector('.dict-tab.active');
    const dictType = activeTab ? activeTab.dataset.dict : 'materials';
    
    const typeNames = {
        materials: 'материал',
        operations: 'операцию',
        defect_types: 'вид дефекта'
    };
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="add-dict-form">
            <div class="form-group">
                <label>Название *</label>
                <input type="text" id="dict-name" required>
            </div>
            ${dictType === 'operations' ? `
                <div class="form-group">
                    <label>Код</label>
                    <input type="text" id="dict-code">
                </div>
            ` : ''}
            ${dictType === 'defect_types' ? `
                <div class="form-group">
                    <label>Категория</label>
                    <input type="text" id="dict-category" placeholder="например: Сварка">
                </div>
            ` : ''}
            <div class="form-group">
                <label>Описание</label>
                <textarea id="dict-desc" rows="2"></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary modal-cancel-btn">Отмена</button>
                <button type="submit" class="btn btn-primary">Добавить</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = `➕ Добавить ${typeNames[dictType]}`;
    showModal();
    
    document.getElementById('add-dict-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = { name: document.getElementById('dict-name').value };
        
        if (dictType === 'operations') {
            data.code = document.getElementById('dict-code').value;
        }
        if (dictType === 'defect_types') {
            data.category = document.getElementById('dict-category').value;
        }
        data.description = document.getElementById('dict-desc').value;
        
        try {
            await api.createDictItem(dictType, data);
            showToast('Добавлено', 'success');
            closeModal();
            loadDictionary(dictType);
            loadDictionaries(); // Обновляем справочники в формах
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function editDictItem(type, id) {
    // Реализация редактирования
    showToast('Функция в разработке', 'info');
}

async function deleteDictItem(type, id) {
    if (!confirm('Деактивировать эту запись?')) return;
    
    try {
        await api.deleteDictItem(type, id);
        showToast('Деактивировано', 'success');
        loadDictionary(type);
        loadDictionaries();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===== Modal Helpers =====

function showModal() {
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('modal').classList.add('hidden');
}

// Bind modal close
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-overlay')?.addEventListener('click', closeModal);
    
    // Bind admin buttons
    document.getElementById('add-user-btn')?.addEventListener('click', showAddUserModal);
    document.getElementById('add-dict-item-btn')?.addEventListener('click', showAddDictItemModal);
    document.getElementById('add-field-btn')?.addEventListener('click', showAddFieldModal);
    document.getElementById('clear-db-btn')?.addEventListener('click', clearDatabase);
    
    // Export/Import CSV
    document.getElementById('export-csv-btn')?.addEventListener('click', exportCSV);
    document.getElementById('import-csv-input')?.addEventListener('change', handleImportCSV);
    
    // Event delegation for dynamic elements (CSP compliance)
    document.addEventListener('click', (e) => {
        // Record cards
        const recordCard = e.target.closest('.record-card[data-record-id]');
        if (recordCard && !e.target.closest('button')) {
            const id = parseInt(recordCard.dataset.recordId);
            editRecord(id);
            return;
        }
        
        // Retry load button
        if (e.target.closest('.retry-load-btn')) {
            loadRecords();
            return;
        }
        
        // Add record button in empty state
        if (e.target.closest('.add-record-btn')) {
            showRecordForm();
            return;
        }
        
        // Edit user
        const editUserBtn = e.target.closest('.edit-user-btn');
        if (editUserBtn) {
            const id = parseInt(editUserBtn.dataset.userId);
            editUser(id);
            return;
        }
        
        // Delete user
        const deleteUserBtn = e.target.closest('.delete-user-btn');
        if (deleteUserBtn) {
            const id = parseInt(deleteUserBtn.dataset.userId);
            deleteUser(id);
            return;
        }
        
        // Edit dict item
        const editDictBtn = e.target.closest('.edit-dict-btn');
        if (editDictBtn) {
            const type = editDictBtn.dataset.dict;
            const id = parseInt(editDictBtn.dataset.id);
            editDictItem(type, id);
            return;
        }
        
        // Delete dict item
        const deleteDictBtn = e.target.closest('.delete-dict-btn');
        if (deleteDictBtn) {
            const type = deleteDictBtn.dataset.dict;
            const id = parseInt(deleteDictBtn.dataset.id);
            deleteDictItem(type, id);
            return;
        }
        
        // Delete field
        const deleteFieldBtn = e.target.closest('.delete-field-btn');
        if (deleteFieldBtn) {
            const id = parseInt(deleteFieldBtn.dataset.fieldId);
            deleteField(id);
            return;
        }
        
        // Modal cancel buttons
        if (e.target.closest('.modal-cancel-btn')) {
            closeModal();
            return;
        }
    });
});

// ===== Helpers =====

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU');
}
