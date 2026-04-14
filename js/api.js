/**
 * API Client для ВИК Контроль (Google Apps Script Backend)
 */

class API {
    constructor() {
        this.baseURL = window.GAS_API_URL || '';
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshPromise = null;
    }

    // ===== Auth =====
    
    async login(username, password) {
        const response = await this._post('login', { username, password });
        
        if (response.success) {
            this.accessToken = response.accessToken;
            localStorage.setItem('accessToken', this.accessToken);
            localStorage.setItem('refreshToken', response.refreshToken);
            localStorage.setItem('user', JSON.stringify(response.user));
        }
        
        return response;
    }

    async logout() {
        try {
            await this._post('logout', {});
        } finally {
            this._clearAuth();
        }
    }

    _clearAuth() {
        this.accessToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }

    isAuthenticated() {
        return !!this.accessToken;
    }

    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    // ===== Records =====
    
    async getRecords(params = {}) {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([_, v]) => v != null && v !== '')
        );
        return this._get('getRecords', cleanParams);
    }

    async getRecord(id) {
        return this._get('getRecord', { id });
    }

    async createRecord(data) {
        return this._post('createRecord', { data });
    }

    async updateRecord(id, data) {
        return this._post('updateRecord', { id, data });
    }

    async deleteRecord(id) {
        return this._post('deleteRecord', { id });
    }

    async getStats(params = {}) {
        return this._get('getStats', params);
    }

    // ===== Dictionaries =====
    
    async getDict(type) {
        return this._get('getDict', { type });
    }

    async createDictItem(type, data) {
        return this._post('createDictItem', { type, data });
    }

    async updateDictItem(type, id, data) {
        return this._post('updateDictItem', { type, id, data });
    }

    async deleteDictItem(type, id) {
        return this._post('deleteDictItem', { type, id });
    }

    // ===== Admin =====
    
    async getUsers(params = {}) {
        return this._get('getUsers', params);
    }

    async getUser(id) {
        return this._get('getUser', { id });
    }

    async createUser(data) {
        return this._post('createUser', { data });
    }

    async updateUser(id, data) {
        return this._post('updateUser', { id, data });
    }

    async resetUserPassword(id, newPassword) {
        return this._post('resetPassword', { id, newPassword });
    }

    async deleteUser(id) {
        return this._post('deleteUser', { id });
    }

    async getAudit(params = {}) {
        return this._get('getAudit', params);
    }

    async clearDatabase() {
        return this._post('clearDatabase', {});
    }

    async exportCSV() {
        const url = `${this.baseURL}?action=exportCSV&token=${encodeURIComponent(this.accessToken)}`;
        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Ошибка экспорта');
        }
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `vik_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(urlObj);
        a.remove();
    }

    async importCSV(file) {
        const text = await file.text();
        return this._post('importCSV', { csvText: text });
    }

    // ===== Schema =====
    
    async getSchemaTable(table) {
        return this._get('getSchemaTable', { table });
    }

    async createField(data) {
        return this._post('createField', { data });
    }

    async deleteField(id) {
        return this._post('deleteField', { id });
    }

    // ===== Internal =====
    
    _buildUrl(action, params = {}) {
        const query = new URLSearchParams({ action, token: this.accessToken, ...params });
        return `${this.baseURL}?${query.toString()}`;
    }

    async _get(action, params = {}) {
        const url = this._buildUrl(action, params);
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) {
            if (data.error === 'Unauthorized' || data.error === 'Invalid token') {
                this._clearAuth();
                window.location.reload();
            }
            throw new Error(data.error);
        }
        return data;
    }

    async _post(action, payload = {}) {
        const body = { action, token: this.accessToken, ...payload };
        
        try {
            let response = await fetch(this.baseURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                redirect: 'follow'
            });
            
            const data = await response.json();
            
            if (data.error) {
                if (data.error === 'Unauthorized' || data.error === 'Invalid token') {
                    this._clearAuth();
                    window.location.reload();
                }
                throw new Error(data.error);
            }
            
            return data;
        } catch (error) {
            if (!navigator.onLine && action !== 'logout') {
                if (offlineQueue && typeof offlineQueue.add === 'function') {
                    offlineQueue.add({ url: this.baseURL, options: { method: 'POST', body: JSON.stringify(body) } });
                }
                throw new Error('OFFLINE');
            }
            throw error;
        }
    }
}

// Singleton instance
const api = new API();
