// ─── Admin Dashboard Component ───────────────────────────────────────────────
const AdminDashboard = () => {
    const { state, dispatch, navigate } = useContext(AppContext);
    const [activeTab, setActiveTab] = React.useState('stats'); // stats, users, cms, admins
    const [stats, setStats] = React.useState(null);
    const [users, setUsers] = React.useState([]);
    const [userSearch, setUserSearch] = React.useState('');
    const [cmsConfig, setCmsConfig] = React.useState({ tagline: '', aboutUs: '', contactUs: '', bannerUrl: '' });
    const [loading, setLoading] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState(null); // For editing
    const [showCreateAdmin, setShowCreateAdmin] = React.useState(false);

    // Fetch Stats
    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await apiCall('/api/admin/stats');
            if (res.success) setStats(res);
        } catch (error) {
            console.error('Stats fetch error', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Users
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await apiCall(`/api/admin/users?search=${userSearch}`);
            if (res.success) setUsers(res.users);
        } catch (error) {
            console.error('Users fetch error', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch CMS Config
    const fetchCms = async () => {
        try {
            const res = await apiCall('/api/admin/config');
            if (res.success) setCmsConfig(res.config);
        } catch (error) {
            console.error('CMS fetch error', error);
        }
    };

    React.useEffect(() => {
        if (activeTab === 'stats') fetchStats();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'cms') fetchCms();
    }, [activeTab]);

    // Debounce user search
    React.useEffect(() => {
        if (activeTab === 'users') {
            const timer = setTimeout(fetchUsers, 500);
            return () => clearTimeout(timer);
        }
    }, [userSearch]);

    const handleUpdateCms = async (e) => {
        e.preventDefault();
        try {
            const res = await apiCall('/api/admin/config', 'PUT', cmsConfig);
            if (res.success) alert('CMS Updated Successfully');
        } catch (error) {
            alert('Update failed');
        }
    };

    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        try {
            const res = await apiCall('/api/admin/create-admin', 'POST', data);
            if (res.success) {
                alert('Admin Created');
                setShowCreateAdmin(false);
            } else {
                alert(res.message);
            }
        } catch (error) {
            alert('creation failed');
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!selectedUser) return;
        try {
            const res = await apiCall(`/api/admin/users/${selectedUser.id}`, 'PUT', selectedUser);
            if (res.success) {
                alert('User Updated');
                setSelectedUser(null);
                fetchUsers();
            }
        } catch (error) {
            alert('Update failed');
        }
    };

    if (!state.user || state.user.role !== 'ADMIN') {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Access Denied. Admins only.</div>;
    }

    return (
        <div className="app-container" style={{ background: '#f3f4f6', minHeight: '100vh', paddingBottom: '80px' }}>
            <header className="header" style={{ background: '#1f2937', padding: '1rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '1.5rem' }}>🛡️</div>
                        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Admin Dashboard</h1>
                    </div>
                    <button onClick={() => { dispatch({ type: 'LOGOUT' }); navigate('landing'); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Logout</button>
                </div>
            </header>

            <nav style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 2rem', display: 'flex', gap: '2rem', overflowX: 'auto' }}>
                {['stats', 'users', 'cms', 'admins'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '1rem 0.5rem',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab ? '2px solid #0B4F78' : '2px solid transparent',
                            color: activeTab === tab ? '#0B4F78' : '#6b7280',
                            fontWeight: activeTab === tab ? '600' : '400',
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </nav>

            <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
                {/* STATS TAB */}
                {activeTab === 'stats' && stats && (
                    <div className="grid grid-2" style={{ gap: '1.5rem' }}>
                        <div className="card">
                            <h3>User Stats</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.counts.customer}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Customers</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.counts.shopkeeper}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Shopkeepers</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.counts.wholesaler}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Wholesalers</div>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <h3>Financials</h3>
                            <div style={{ marginTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Total Settled:</span>
                                    <span style={{ color: '#10B981', fontWeight: 'bold' }}>₹{stats.financials.settled.toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '600', marginTop: '1rem', marginBottom: '0.5rem' }}>Unsettled Amounts:</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span>Friend-Friend:</span>
                                    <span>₹{stats.financials.unsettled.friend.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span>Shop:</span>
                                    <span>₹{stats.financials.unsettled.shop.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span>Wholesale:</span>
                                    <span>₹{stats.financials.unsettled.wholesale.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3>User Management</h3>
                            <input
                                type="text"
                                placeholder="Search by name or mobile..."
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                            />
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={{ padding: '0.75rem' }}>Name</th>
                                        <th style={{ padding: '0.75rem' }}>Mobile</th>
                                        <th style={{ padding: '0.75rem' }}>Role</th>
                                        <th style={{ padding: '0.75rem' }}>Status</th>
                                        <th style={{ padding: '0.75rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.75rem' }}>{u.name}</td>
                                            <td style={{ padding: '0.75rem' }}>{u.mobile}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem',
                                                    background: u.role === 'ADMIN' ? '#e0e7ff' : u.role === 'WHOLESALER' ? '#dcfce7' : '#f3f4f6',
                                                    color: u.role === 'ADMIN' ? '#3730a3' : u.role === 'WHOLESALER' ? '#166534' : '#374151'
                                                }}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{ color: u.isActive ? '#10B981' : '#EF4444' }}>{u.isActive ? 'Active' : 'Inactive'}</span>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <button onClick={() => setSelectedUser(u)} style={{ padding: '0.3rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* CMS TAB */}
                {activeTab === 'cms' && (
                    <div className="card">
                        <h3>Content Management</h3>
                        <form onSubmit={handleUpdateCms} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tagline</label>
                                <input
                                    type="text"
                                    value={cmsConfig.tagline || ''}
                                    onChange={e => setCmsConfig({ ...cmsConfig, tagline: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Banner URL</label>
                                <input
                                    type="text"
                                    value={cmsConfig.bannerUrl || ''}
                                    onChange={e => setCmsConfig({ ...cmsConfig, bannerUrl: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>About Us Text</label>
                                <textarea
                                    value={cmsConfig.aboutUs || ''}
                                    onChange={e => setCmsConfig({ ...cmsConfig, aboutUs: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%', minHeight: '100px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Contact Us Details</label>
                                <textarea
                                    value={cmsConfig.contactUs || ''}
                                    onChange={e => setCmsConfig({ ...cmsConfig, contactUs: e.target.value })}
                                    className="form-input"
                                    style={{ width: '100%', minHeight: '100px' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save Changes</button>
                        </form>
                    </div>
                )}

                {/* ADMINS TAB */}
                {activeTab === 'admins' && (
                    <div className="card">
                        <h3>Admin Management</h3>
                        <button onClick={() => setShowCreateAdmin(true)} className="btn btn-primary" style={{ marginTop: '1rem' }}>+ Register New Admin</button>

                        {showCreateAdmin && (
                            <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '8px' }}>
                                <h4>Register New Admin</h4>
                                <form onSubmit={handleCreateAdmin} style={{ display: 'grid', gap: '1rem', maxWidth: '400px', marginTop: '1rem' }}>
                                    <input name="name" placeholder="Full Name" required className="form-input" />
                                    <input name="mobile" placeholder="Mobile Number" required className="form-input" />
                                    <input name="password" type="password" placeholder="Password" required className="form-input" />
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button type="submit" className="btn btn-primary">Create</button>
                                        <button type="button" onClick={() => setShowCreateAdmin(false)} className="btn btn-outline">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* EDIT USER MODAL */}
            {selectedUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3>Edit User: {selectedUser.name}</h3>
                        <form onSubmit={handleUpdateUser} style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
                            <div>
                                <label>Name</label>
                                <input value={selectedUser.name} onChange={e => setSelectedUser({ ...selectedUser, name: e.target.value })} className="form-input" style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label>Mobile</label>
                                <input value={selectedUser.mobile} onChange={e => setSelectedUser({ ...selectedUser, mobile: e.target.value })} className="form-input" style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label>Role</label>
                                <select value={selectedUser.role} onChange={e => setSelectedUser({ ...selectedUser, role: e.target.value })} className="form-input" style={{ width: '100%' }}>
                                    <option value="CUSTOMER">CUSTOMER</option>
                                    <option value="SHOPKEEPER">SHOPKEEPER</option>
                                    <option value="WHOLESALER">WHOLESALER</option>
                                    <option value="ADMIN">ADMIN</option>
                                </select>
                            </div>
                            <div>
                                <label>Status</label>
                                <select value={selectedUser.isActive} onChange={e => setSelectedUser({ ...selectedUser, isActive: e.target.value === 'true' })} className="form-input" style={{ width: '100%' }}>
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                            {/* Sensitive fields */}
                            <div>
                                <label>Aadhaar (Encrypted Update)</label>
                                <input placeholder="Update Aadhaar" value={selectedUser.aadhaarNumber || ''} onChange={e => setSelectedUser({ ...selectedUser, aadhaarNumber: e.target.value })} className="form-input" style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label>GSTIN</label>
                                <input placeholder="Update GST" value={selectedUser.gstNumber || ''} onChange={e => setSelectedUser({ ...selectedUser, gstNumber: e.target.value })} className="form-input" style={{ width: '100%' }} />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn btn-primary">Save Changes</button>
                                <button type="button" onClick={() => setSelectedUser(null)} className="btn btn-outline">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
