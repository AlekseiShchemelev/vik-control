/**
 * API Client для ВИК Контроль (Google Apps Script Backend)
 * ВСЕ запросы идут через GET с payload в query string
 * чтобы полностью избежать CORS preflight
 */

class API {
    constructor() {
        this.baseURL = window.GAS_API_URL || '';
        this.accessToken = localStorage.getItem('accessToken');
        this.warmedUp = false;
    }

    // Разогрев GAS (cold start ускорение)
    warmUp() {
        if (this.warmedUp || !this.baseURL) return;
        this.warmedUp = true;
        fetch(`${this.baseURL}?payload=${encodeURIComponent(JSON.stringify({action:'health'}))}`)
            .catch(() => {});
    }

    // ===== Auth =====
    
    async login(username, password) {
        const response = await this._request('login', { username, password });
        
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
            await this._request('logout', {});
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
        return this._request('getRecords', cleanParams);
    }

    async getRecord(id) {
        return this._request('getRecord', { id });
    }

    async createRecord(data) {
        return this._request('createRecord', { data });
    }

    async updateRecord(id, data) {
        return this._request('updateRecord', { id, data });
    }

    async deleteRecord(id) {
        return this._request('deleteRecord', { id });
    }

    async getStats(params = {}) {
        return this._request('getStats', params);
    }

    // ===== Dictionaries =====
    
    async getDict(type, params = {}) {
        return this._request('getDict', { type, ...params });
    }

    async createDictItem(type, data) {
        return this._request('createDictItem', { type, data });
    }

    async updateDictItem(type, id, data) {
        return this._request('updateDictItem', { type, id, data });
    }

    async deleteDictItem(type, id) {
        return this._request('deleteDictItem', { type, id });
    }

    // ===== Admin =====
    
    async getUsers(params = {}) {
        return this._request('getUsers', params);
    }

    async getUserById(id) {
        return this._request('getUser', { id });
    }

    async createUser(data) {
        return this._request('createUser', { data });
    }

    async updateUser(id, data) {
        return this._request('updateUser', { id, data });
    }

    async resetUserPassword(id, newPassword) {
        return this._request('resetPassword', { id, newPassword });
    }

    async deleteUser(id) {
        return this._request('deleteUser', { id });
    }

    async getAudit(params = {}) {
        return this._request('getAudit', params);
    }

    async clearDatabase() {
        return this._request('clearDatabase', {});
    }

    async exportCSV() {
        const url = `${this.baseURL}?action=exportCSV&token=${encodeURIComponent(this.accessToken || '')}`;
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
        // POST fallback для больших данных (CSV может не влезть в URL)
        const body = JSON.stringify({ action: 'importCSV', token: this.accessToken || '', csvText: text });
        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                body: body
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            return data;
        } catch (error) {
            if (!navigator.onLine) {
                if (offlineQueue && typeof offlineQueue.add === 'function') {
                    offlineQueue.add({ url: this.baseURL, options: { method: 'POST', body: body } });
                }
                throw new Error('OFFLINE');
            }
            throw error;
        }
    }

    // ===== Schema =====
    
    async getSchemaTable(table) {
        return this._request('getSchemaTable', { table });
    }

    async createField(data) {
        return this._request('createField', { data });
    }

    async deleteField(id) {
        return this._request('deleteField', { id });
    }

    // ===== Internal =====
    
    async _request(action, payload = {}) {
        const data = { action, token: this.accessToken || '', ...payload };
        const payloadStr = JSON.stringify(data);
        const url = `${this.baseURL}?payload=${encodeURIComponent(payloadStr)}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.error) {
            if (result.error === 'Unauthorized' || result.error === 'Invalid token') {
                this._clearAuth();
                window.location.reload();
            }
            throw new Error(result.error);
        }
        
        return result;
    }
}

// Singleton instance
const api = new API();
