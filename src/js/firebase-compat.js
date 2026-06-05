(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.apiBase) || '';
    var JWT_KEY = 'ku_dhrms_jwt';
    var authStateListeners = [];
    var currentUser = null;
    var authStateInterval = null;
    var FETCH_OPTIONS = { credentials: 'same-origin' };

    function getJwt() {
        try { return sessionStorage.getItem(JWT_KEY); } catch { return null; }
    }

    function setJwt(token) {
        try { sessionStorage.setItem(JWT_KEY, token); } catch {}
    }

    function clearJwt() {
        try { sessionStorage.removeItem(JWT_KEY); } catch {}
    }

    function decodeJwt(token) {
        try {
            var parts = token.split('.');
            var payload = JSON.parse(atob(parts[1]));
            return {
                uid: payload.sub || payload.user_id,
                email: payload.email,
                role: payload.role,
                exp: payload.exp
            };
        } catch { return null; }
    }

    function isTokenExpired(payload) {
        if (!payload || !payload.exp) return true;
        return Date.now() >= payload.exp * 1000;
    }

    function notifyAuthState(user) {
        currentUser = user ? { uid: user.uid, email: user.email } : null;
        for (var i = 0; i < authStateListeners.length; i++) {
            try { authStateListeners[i](currentUser); } catch (e) { console.error('Auth listener error:', e); }
        }
    }

    function checkAuthState() {
        var token = getJwt();
        if (!token) {
            if (currentUser) notifyAuthState(null);
            return;
        }
        var payload = decodeJwt(token);
        if (!payload || isTokenExpired(payload)) {
            clearJwt();
            if (currentUser) notifyAuthState(null);
            return;
        }
        if (!currentUser || currentUser.uid !== payload.uid) {
            notifyAuthState(payload);
        }
    }

    function api(path, options) {
        options = options || {};
        var url = API_BASE + path;
        var opts = {
            method: options.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            ...FETCH_OPTIONS
        };
        var token = getJwt();
        if (token) opts.headers['Authorization'] = 'Bearer ' + token;
        if (options.body) opts.body = JSON.stringify(options.body);
        return fetch(url, opts).then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw e; });
            return r.json();
        });
    }

    function apiFormData(path, formData) {
        var url = API_BASE + path;
        var opts = {
            method: 'POST',
            body: formData,
            ...FETCH_OPTIONS
        };
        var token = getJwt();
        if (token) opts.headers = { 'Authorization': 'Bearer ' + token };
        return fetch(url, opts).then(function (r) {
            if (!r.ok) return r.json().then(function (e) { throw e; });
            return r.json();
        });
    }

    // ============ FieldValue ============

    var FieldValue = {
        serverTimestamp: function () { return { __serverTimestamp: true }; },
        increment: function (n) { return { __increment: n }; },
        arrayUnion: function () {
            var args = Array.prototype.slice.call(arguments);
            return { __arrayUnion: args };
        },
        arrayRemove: function () {
            var args = Array.prototype.slice.call(arguments);
            return { __arrayRemove: args };
        },
        delete: function () { return { __delete: true }; }
    };

    // ============ DocumentReference ============

    function DocumentReference(collection, id) {
        this._collection = collection;
        this._id = id;
    }

    DocumentReference.prototype.get = function () {
        var self = this;
        return api('/api/fs/' + encodeURIComponent(self._collection) + '/' + encodeURIComponent(self._id))
            .then(function (data) {
                return {
                    exists: data.exists === true,
                    id: self._id,
                    data: function () { return data.data ? (typeof data.data === 'function' ? data.data() : data.data) : null; },
                    ref: self,
                    get: function () { return self.get(); }
                };
            });
    };

    DocumentReference.prototype.set = function (data, opts) {
        var self = this;
        var merge = opts && opts.merge === true;
        return api('/api/fs/' + encodeURIComponent(self._collection) + '/' + encodeURIComponent(self._id), {
            method: 'PUT',
            body: { data: data, merge: merge }
        }).then(function () { return self; });
    };

    DocumentReference.prototype.update = function (data) {
        var self = this;
        return api('/api/fs/' + encodeURIComponent(self._collection) + '/' + encodeURIComponent(self._id), {
            method: 'PATCH',
            body: { data: data }
        }).then(function () { return self; });
    };

    DocumentReference.prototype.delete = function () {
        var self = this;
        return api('/api/fs/' + encodeURIComponent(self._collection) + '/' + encodeURIComponent(self._id), {
            method: 'DELETE'
        }).then(function () { return self; });
    };

    DocumentReference.prototype.onSnapshot = function (callback) {
        var self = this;
        function poll() {
            self.get().then(function (doc) {
                callback(doc);
            }).catch(function () {});
        }
        poll();
        var interval = setInterval(poll, 5000);
        return function () { clearInterval(interval); };
    };

    // ============ CollectionReference / Query ============

    function CollectionReference(name) {
        this._name = name;
        this._filters = [];
        this._orders = [];
        this._limitVal = null;
        this._offsetVal = null;
    }

    CollectionReference.prototype.doc = function (id) {
        return new DocumentReference(this._name, id);
    };

    CollectionReference.prototype.add = function (data) {
        var self = this;
        return api('/api/fs/' + encodeURIComponent(self._name), {
            method: 'POST',
            body: { data: data }
        }).then(function (result) {
            return {
                id: result.id,
                get: function () { return new DocumentReference(self._name, result.id).get(); }
            };
        });
    };

    CollectionReference.prototype.where = function (field, op, value) {
        this._filters.push({ field: field, op: op, value: value });
        return this;
    };

    CollectionReference.prototype.orderBy = function (field, dir) {
        this._orders.push({ field: field, dir: dir || 'asc' });
        return this;
    };

    CollectionReference.prototype.limit = function (n) {
        this._limitVal = n;
        return this;
    };

    CollectionReference.prototype.offset = function (n) {
        this._offsetVal = n;
        return this;
    };

    CollectionReference.prototype.get = function () {
        var self = this;
        return api('/api/fs/' + encodeURIComponent(self._name) + '/query', {
            method: 'POST',
            body: {
                filters: self._filters,
                orderBy: self._orders,
                limit: self._limitVal,
                offset: self._offsetVal
            }
        }).then(function (data) {
            var docs = (data.documents || []).map(function (d) {
                return {
                    id: d.id,
                    exists: d.exists !== false,
                    data: function () { return d.data || {}; },
                    ref: new DocumentReference(self._name, d.id)
                };
            });
            return {
                docs: docs,
                forEach: function (fn) { docs.forEach(fn); },
                size: docs.length,
                empty: docs.length === 0,
                docChanges: function () { return []; }
            };
        });
    };

    CollectionReference.prototype.onSnapshot = function (callback) {
        var self = this;
        function poll() {
            self.get().then(function (snap) {
                callback(snap);
            }).catch(function () {});
        }
        poll();
        var interval = setInterval(poll, 5000);
        return function () { clearInterval(interval); };
    };

    // ============ Auth ============

    var Auth = {
        signInWithEmailAndPassword: function (email, password) {
            return api('/api/auth/signin', {
                method: 'POST',
                body: { email: email, password: password }
            }).then(function (data) {
                if (data.idToken) setJwt(data.idToken);
                checkAuthState();
                return {
                    user: { uid: data.localId, email: data.email },
                    credential: null,
                    additionalUserInfo: null
                };
            });
        },

        createUserWithEmailAndPassword: function (email, password) {
            return api('/api/auth/signup', {
                method: 'POST',
                body: { email: email, password: password }
            }).then(function (data) {
                if (data.idToken) setJwt(data.idToken);
                checkAuthState();
                return {
                    user: { uid: data.localId, email: data.email },
                    additionalUserInfo: null
                };
            });
        },

        signOut: function () {
            clearJwt();
            checkAuthState();
            return Promise.resolve();
        },

        onAuthStateChanged: function (callback) {
            authStateListeners.push(callback);
            if (!authStateInterval) {
                checkAuthState();
                authStateInterval = setInterval(checkAuthState, 30000);
            }
            if (currentUser) {
                setTimeout(function () { callback(currentUser); }, 0);
            }
            var self = this;
            return function () {
                var idx = authStateListeners.indexOf(callback);
                if (idx !== -1) authStateListeners.splice(idx, 1);
            };
        },

        onIdTokenChanged: function (callback) {
            return this.onAuthStateChanged(callback);
        },

        signInWithCustomToken: function (token) {
            setJwt(token);
            checkAuthState();
            var payload = decodeJwt(token);
            return Promise.resolve({
                user: payload ? { uid: payload.uid, email: payload.email } : null
            });
        },

        sendPasswordResetEmail: function (email) {
            return api('/api/auth/reset-password', {
                method: 'POST',
                body: { email: email }
            });
        },

        updatePassword: function (newPassword) {
            var user = currentUser;
            if (!user) return Promise.reject(new Error('Not authenticated'));
            return api('/api/auth/update-password', {
                method: 'POST',
                body: { uid: user.uid, password: newPassword }
            });
        },

        signInWithPopup: function () {
            return Promise.reject(new Error('signInWithPopup not supported in local mode'));
        },

        signInWithRedirect: function () {
            return Promise.reject(new Error('signInWithRedirect not supported in local mode'));
        }
    };

    Object.defineProperty(Auth, 'currentUser', {
        get: function () { return currentUser; },
        enumerable: true,
        configurable: true
    });

    // ============ Storage ============

    function StorageReference(path) {
        this._path = path;
    }

    StorageReference.prototype.put = function (file, metadata) {
        var self = this;
        var formData = new FormData();
        formData.append('file', file);
        formData.append('path', self._path);
        if (metadata) formData.append('metadata', JSON.stringify(metadata));
        return apiFormData('/api/storage/upload', formData).then(function (data) {
            return {
                metadata: data.metadata,
                ref: self,
                task: Promise.resolve(data.metadata)
            };
        });
    };

    StorageReference.prototype.getDownloadURL = function () {
        var self = this;
        return Promise.resolve('/api/storage/' + self._path);
    };

    StorageReference.prototype.child = function (path) {
        return new StorageReference(this._path + '/' + path);
    };

    StorageReference.prototype.delete = function () {
        return Promise.reject(new Error('Storage delete not implemented'));
    };

    Object.defineProperty(StorageReference.prototype, 'name', {
        get: function () {
            var parts = this._path.split('/');
            return parts[parts.length - 1];
        },
        enumerable: true
    });

    Object.defineProperty(StorageReference.prototype, 'parent', {
        get: function () {
            var parts = this._path.split('/');
            parts.pop();
            return new StorageReference(parts.join('/'));
        },
        enumerable: true
    });

    Object.defineProperty(StorageReference.prototype, 'root', {
        get: function () { return new StorageReference(''); },
        enumerable: true
    });

    // ============ Firestore ============

    function Firestore() { }

    Firestore.prototype.collection = function (name) {
        return new CollectionReference(name);
    };

    // ============ Storage Root ============

    function StorageRoot() { }

    StorageRoot.prototype.ref = function (path) {
        return new StorageReference(path || '');
    };

    // ============ Firebase Namespace ============

    function firestoreFactory() {
        return new Firestore();
    }
    firestoreFactory.FieldValue = FieldValue;

    var firebase = {
        initializeApp: function (config) {
            var projectId = config && config.projectId;
            return { name: '[DEFAULT]', options: config };
        },
        app: function () {
            return { name: '[DEFAULT]', options: {} };
        },
        auth: function () { return Auth; },
        firestore: firestoreFactory,
        storage: function () { return new StorageRoot(); },
        SDK_VERSION: '10.8.0-compat-local'
    };

    window.firebase = firebase;

    checkAuthState();
})();
