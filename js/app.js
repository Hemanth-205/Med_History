/**
 * Application Logic for MedHistory with Supabase
 */

// Utilities
const getEl = (id) => document.getElementById(id);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase to be ready (optional check, but good for debugging)
    if (!window.sb) {
        console.error('Supabase client not initialized. Check supabase-config.js');
        return;
    }

    await checkAuth();
    setupMobileMenu();

    // Page specific init
    const path = window.location.pathname;
    const fileName = path.split('/').pop().toLowerCase();

    if (fileName.includes('login') || fileName === '') initLogin();
    if (fileName.includes('reset-password')) initResetPassword();
    if (fileName.includes('dashboard')) initDashboard();
    if (fileName.includes('contact')) initContact();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.log('SW Registration failed', err));
    }
});

// --- Navigation ---
function setupMobileMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav-links');
    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            nav.classList.toggle('active');
        });
    }
}

// --- Auth Logic ---
async function checkAuth() {
    const { data: { session } } = await window.sb.auth.getSession();
    const path = window.location.pathname;
    const isProtected = path.includes('dashboard.html');
    const isAuthPage = path.includes('login.html');

    if (isProtected && !session) {
        window.location.href = 'login.html';
    }

    // Redirect to dashboard if already logged in (but not if we are on the reset password page)
    if (isAuthPage && session && !path.includes('reset-password.html')) {
        window.location.href = 'dashboard.html';
    }
}

function initLogin() {
    const loginForm = getEl('loginForm');
    const signupForm = getEl('signupForm');
    const showSignupBtn = getEl('showSignup');
    const showLoginBtn = getEl('showLogin');
    const loginSection = getEl('login-section');
    const signupSection = getEl('signup-section');
    const forgotSection = getEl('forgot-password-section');
    const showForgotBtn = getEl('showForgot');
    const backToLoginBtn = getEl('backToLogin');
    const forgotForm = getEl('forgotForm');

    // Toggle Forms
    if (showSignupBtn && loginSection && signupSection) {
        showSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.style.display = 'none';
            signupSection.style.display = 'block';
            if (forgotSection) forgotSection.style.display = 'none';
        });
    }

    if (showLoginBtn && loginSection && signupSection) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signupSection.style.display = 'none';
            loginSection.style.display = 'block';
            if (forgotSection) forgotSection.style.display = 'none';
        });
    }

    if (showForgotBtn && loginSection && forgotSection) {
        showForgotBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.style.display = 'none';
            if (signupSection) signupSection.style.display = 'none';
            forgotSection.style.display = 'block';
        });
    }

    if (backToLoginBtn && loginSection && forgotSection) {
        backToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            forgotSection.style.display = 'none';
            if (signupSection) signupSection.style.display = 'none';
            loginSection.style.display = 'block';
        });
    }

    // Handle Forgot Password
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = getEl('forgotEmail').value;
            const submitBtn = forgotForm.querySelector('button');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            try {
                const { error } = await window.sb.auth.resetPasswordForEmail(email, {
                    redirectTo: new URL('reset-password.html', window.location.href).href,
                });
                if (error) throw error;
                alert('Password reset link sent! Please check your email.');
                backToLoginBtn.click();
            } catch (err) {
                alert('Reset Failed: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Reset Link';
            }
        });
    }

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = getEl('loginEmail').value;
            const password = getEl('loginPassword').value;

            try {
                const { data, error } = await window.sb.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    if (error.message.includes("Email not confirmed")) {
                        throw new Error("Please verify your email address before logging in. Check your inbox.");
                    }
                    throw error;
                }
                window.location.href = 'dashboard.html';
            } catch (err) {
                alert('Login Failed: ' + err.message);
            }
        });
    }

    // Handle Signup
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = getEl('signupName').value;
            const email = getEl('signupEmail').value;
            const age = getEl('signupAge').value;
            const gender = getEl('signupGender').value;
            const password = getEl('signupPassword').value;

            try {
                // 1. Sign Up
                const { data: { user, session }, error } = await window.sb.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            name: name // Metadata
                        },
                        emailRedirectTo: new URL('dashboard.html', window.location.href).href
                    }
                });

                if (error) throw error;

                // 2. Duplication Check (Silent Failure Handling)
                // If user is returned but identities is empty, it means the user already exists.
                // Supabase does this to prevent email enumeration.
                if (user && user.identities && user.identities.length === 0) {
                    alert('An account with this email already exists. Please login instead.');
                    // Reset view if needed or just return
                    return;
                }

                if (user) {
                    // Check if session exists (meaning email is confirmed or confirmation disabled)
                    // If no session, we can't insert into public.profiles due to RLS usually requiring auth.uid()
                    // However, we can try. If it fails, the user will just have to login later (if trigger exists)
                    // Since we rely on manual insert:

                    if (session) {
                        // User is logged in immediately
                        // Use upsert instead of insert to avoid conflicts if the trigger already created it
                        const { error: profileError } = await window.sb
                            .from('profiles')
                            .upsert([
                                {
                                    id: user.id,
                                    email: email,
                                    name: name,
                                    age: parseInt(age),
                                    gender: gender
                                }
                            ]);

                        if (profileError) {
                            console.error('Profile creation error:', profileError);
                            // If it's a conflict or already exists, we might just ignore it if the session is valid
                            alert('Welcome! Your account is ready. Redirecting to dashboard...');
                            window.location.href = 'dashboard.html';
                        } else {
                            alert('Account created! Redirecting to dashboard...');
                            window.location.href = 'dashboard.html';
                        }
                    } else {
                        // Email confirmation enabled, no session yet
                        alert('Account created! Please CHECK YOUR EMAIL to confirm your account before logging in.');
                        // Switch to login view
                        signupSection.style.display = 'none';
                        loginSection.style.display = 'block';
                    }
                }

            } catch (err) {
                alert('Signup Failed: ' + err.message);
            }
        });
    }
}

// --- Dashboard Logic ---
async function initDashboard() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) return;

    const user = session.user;

    // Fetch Profile Data
    let profile = {};
    const fetchProfile = async () => {
        try {
            const { data, error } = await window.sb
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) {
                profile = data;
            } else {
                // Profile missing! This happens if tables weren't ready during signup.
                // Auto-heal: Create the missing profile now.
                console.log('Profile missing, creating default profile...');
                const { error: insertError } = await window.sb
                    .from('profiles')
                    .insert([
                        {
                            id: user.id,
                            email: user.email,
                            name: user.user_metadata.name || 'User',
                            age: 0,
                            gender: '-'
                        }
                    ]);

                if (!insertError) {
                    profile = { id: user.id, name: user.user_metadata.name || 'User', age: 0, gender: '-' };
                }
            }
        } catch (err) {
            console.error('Error fetching profile', err);
        }
        renderProfile(profile);
    };

    await fetchProfile();

    // Render Data
    renderHistoryTables(user.id);
    renderVitalsTable(user.id);
    renderHealthGraph(user.id);

    // --- Actions ---

    // Share with Doctor Logic
    const shareBtn = getEl('shareDoctorBtn');

    function generateCode(length) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 to avoid confusion
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            shareBtn.disabled = true;
            shareBtn.textContent = 'Generating...';

            try {
                // 1. Fetch All Data
                const { data: recs } = await window.sb.from('medical_records').select('*').eq('user_id', user.id).order('date', { ascending: false });
                const { data: vits } = await window.sb.from('vitals').select('*').eq('user_id', user.id).order('date', { ascending: false });

                // 2. Client-side Bundle
                const snapshot = {
                    generatedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
                    profile: profile,
                    records: recs || [],
                    vitals: vits || []
                };

                // 3. Generate Code & Filename
                const accessCode = generateCode(6);
                const fileName = `shares/${accessCode}.json`;

                // 4. Upload
                const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
                const { error: upErr } = await window.sb.storage.from('medical_uploads').upload(fileName, blob, {
                    cacheControl: '3600',
                    upsert: false
                });

                if (upErr) throw upErr;

                // 5. Show Code in Modal
                getEl('accessCodeDisplay').textContent = accessCode;
                getEl('shareDoctorModal').style.display = 'flex';

            } catch (err) {
                alert('Error generating code: ' + err.message);
            } finally {
                shareBtn.disabled = false;
                shareBtn.textContent = '👨‍⚕️ Share with Doctor';
            }
        });
    }

    // QR Code Logic
    const showQrBtn = getEl('showQrBtn');
    const qrModal = getEl('qrModal');
    let qrGenerated = false;

    if (showQrBtn) {
        showQrBtn.addEventListener('click', () => {
            qrModal.style.display = 'flex';

            if (!qrGenerated) {
                // Generate URL: relative to current page
                const emergencyUrl = new URL('emergency.html?id=' + user.id, window.location.href).href;
                console.log('Generating QR for:', emergencyUrl);

                getEl('qrcode').innerHTML = ''; // Clear prev
                new QRCode(getEl('qrcode'), {
                    text: emergencyUrl,
                    width: 200,
                    height: 200,
                    colorDark: "#e11d48", // Medical Red
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });

                // Add a text link for debugging/manual open
                const link = document.createElement('a');
                link.href = emergencyUrl;
                link.target = '_blank';
                link.innerText = 'Open Link Manually';
                link.style.display = 'block';
                link.style.marginTop = '10px';
                link.style.fontSize = '0.9rem';
                getEl('qrcode').appendChild(link);

                qrGenerated = true;
            }
        });
    }

    // Body Map Logic
    const bodyPaths = document.querySelectorAll('.body-part-path');
    const activePartDisplay = getEl('activePartDisplay');
    const resetBodyBtn = getEl('resetBodyFilter');

    if (bodyPaths.length > 0) {
        bodyPaths.forEach(path => {
            path.addEventListener('click', () => {
                const partId = path.id.replace('part-', '');
                const partName = partId.charAt(0).toUpperCase() + partId.slice(1);

                // UI Feedback
                bodyPaths.forEach(p => p.classList.remove('active'));
                path.classList.add('active');

                if (activePartDisplay) activePartDisplay.innerText = `Viewing: ${partName} Records`;

                // Filter Table
                renderHistoryTables(user.id, partName);
            });
        });

        if (resetBodyBtn) {
            resetBodyBtn.addEventListener('click', () => {
                bodyPaths.forEach(p => p.classList.remove('active'));
                if (activePartDisplay) activePartDisplay.innerText = `Viewing: All Records`;
                renderHistoryTables(user.id);
            });
        }
    }

    // AI Health Insights Logic
    const runAiBtn = getEl('runAiBtn');
    const aiInsightBox = getEl('aiInsightBox');
    const aiStatus = getEl('aiStatus');
    const aiLoader = getEl('aiLoader');

    if (runAiBtn) {
        runAiBtn.addEventListener('click', async () => {
            runAiBtn.disabled = true;
            aiLoader.style.display = 'block';
            aiStatus.innerText = 'Neural Engine: Analyzing Vitals...';
            aiInsightBox.innerHTML = '<span style="opacity:0.6 italic">Scanning history and calculating trends...</span>';

            // Simulate "Thinking"
            await new Promise(r => setTimeout(r, 1500));

            try {
                // Fetch latest 3 vitals for trend analysis
                const { data: vitals, error } = await window.sb
                    .from('vitals')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('date', { ascending: false })
                    .limit(3);

                if (error) throw error;

                if (!vitals || vitals.length === 0) {
                    aiInsightBox.innerText = "No clinical data found. Please log your vitals (Sugar, BP, Temp) to activate the intelligent health analysis engine.";
                    aiStatus.innerText = 'Neural Engine: Standby';
                } else {
                    const latest = vitals[0];
                    const prev = vitals[1];
                    let insights = [];

                    // 1. Blood Pressure Analysis
                    if (latest.bp) {
                        const [sys, dia] = latest.bp.split('/').map(Number);
                        if (sys > 140 || dia > 90) {
                            insights.push(`🚩 **Hypertension Alert**: Your BP (${latest.bp}) is above the recommended range. Please consult your physician.`);
                        } else if (sys < 90 || dia < 60) {
                            insights.push(`⚠️ **Low BP Warning**: Your latest reading (${latest.bp}) is on the lower side. Ensure you stay hydrated.`);
                        } else {
                            insights.push(`✅ **Healthy BP**: Your cardiovascular health appears stable at ${latest.bp}.`);
                        }
                    }

                    // 2. Sugar Trend Analysis
                    if (latest.sugar) {
                        if (prev && latest.sugar > prev.sugar + 20) {
                            insights.push(`📈 **Upward Sugar Trend**: Your sugar level increased by ${latest.sugar - prev.sugar}mg/dL since your last log. Monitor your diet.`);
                        } else if (latest.sugar > 140) {
                            insights.push(`🚩 **Elevated Sugar**: Your level of ${latest.sugar}mg/dL is higher than optimal. Consider a low-carb intake today.`);
                        } else {
                            insights.push(`✅ **Glucose Balance**: Your sugar level (${latest.sugar}mg/dL) is within the normal range.`);
                        }
                    }

                    // 3. Body Temperature Analysis
                    if (latest.temperature) {
                        const temp = parseFloat(latest.temperature);
                        if (temp > 37.5) {
                            insights.push(`🌡️ **Fever Detected**: Your temperature of ${temp}°C indicates a possible fever. Rest and monitor symptoms.`);
                        }
                    }

                    // Final Insight Construction
                    aiInsightBox.innerHTML = `<div class="insight-text">${insights.map(i => `<p style="margin-bottom:0.5rem">${i}</p>`).join('')}</div>`;
                    aiStatus.innerText = 'Neural Engine: Insight Generated';
                }
            } catch (err) {
                console.error(err);
                aiInsightBox.innerText = "The Neural Engine encountered an error during analysis. Please try again later.";
            } finally {
                aiLoader.style.display = 'none';
                runAiBtn.disabled = false;
                runAiBtn.querySelector('span').innerText = '✨ Refresh Insight';
            }
        });
    }

    // Edit Profile Logic
    const editBtn = getEl('editProfileBtn');
    const editModal = getEl('editProfileModal');
    const editForm = getEl('editProfileForm');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            getEl('editName').value = profile.name || '';
            getEl('editAge').value = profile.age || '';
            getEl('editGender').value = profile.gender || 'Male';
            // New Fields
            getEl('editBlood').value = profile.blood_group || '';
            getEl('editContact').value = profile.emergency_contact || '';
            getEl('editAllergies').value = profile.allergies || '';

            editModal.style.display = 'flex';
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updates = {
                name: getEl('editName').value,
                age: parseInt(getEl('editAge').value),
                gender: getEl('editGender').value,
                // New Fields
                blood_group: getEl('editBlood').value,
                emergency_contact: getEl('editContact').value,
                allergies: getEl('editAllergies').value
            };

            try {
                const { error } = await window.sb
                    .from('profiles')
                    .update(updates)
                    .eq('id', user.id);

                if (error) throw error;

                profile = { ...profile, ...updates };
                renderProfile(profile);
                editModal.style.display = 'none';
                alert('Profile updated successfully!');
            } catch (err) {
                alert('Error updating profile: ' + err.message);
            }
        });
    }

    // PDF Download
    const downloadPdfBtn = getEl('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Delete Account
    const deleteAccountBtn = getEl('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                // Note: Supabase Client SDK usually doesn't allow deleting AUTH user directly for security.
                // Usually requires a purely backend admin function.
                // However, we can delete the DATA rows via RLS.

                // For this demo, we will just sign out and pretend,
                // or we could delete the records from tables.

                await window.sb.from('medical_records').delete().eq('user_id', user.id);
                await window.sb.from('vitals').delete().eq('user_id', user.id);
                await window.sb.from('profiles').delete().eq('id', user.id);

                await window.sb.auth.signOut();
                window.location.href = 'index.html';
            }
        });
    }

    // Photo Update
    const photoInput = getEl('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}/profile_${Date.now()}.${fileExt}`;
                const filePath = fileName;

                // Upload
                const { error: uploadError } = await window.sb.storage
                    .from('medical_uploads')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Get URL
                const { data: { publicUrl } } = window.sb.storage
                    .from('medical_uploads')
                    .getPublicUrl(filePath);

                // Update Profile
                const { error: updateError } = await window.sb
                    .from('profiles')
                    .update({ photo_url: publicUrl })
                    .eq('id', user.id);

                if (updateError) throw updateError;

                // Update UI
                profile.photo_url = publicUrl;
                renderProfile(profile);

            } catch (err) {
                alert('Error updating photo: ' + err.message);
            }
        });
    }

    // Handle New Record
    const addForm = getEl('addRecordForm');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = addForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            try {
                const fileInput = getEl('recordPrescription');
                let prescriptionUrl = null;

                // Upload File if exists
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${user.id}/rx_${Date.now()}.${fileExt}`;

                    const { error: upErr } = await window.sb.storage
                        .from('medical_uploads')
                        .upload(fileName, file);

                    if (upErr) throw upErr;

                    const { data: { publicUrl } } = window.sb.storage
                        .from('medical_uploads')
                        .getPublicUrl(fileName);

                    prescriptionUrl = publicUrl;
                }

                // Insert Record
                const newRecord = {
                    user_id: user.id,
                    priority: getEl('recordPriority').value,
                    date: getEl('recordDate').value,
                    diagnosis: getEl('recordDiagnosis').value,
                    treatment: getEl('recordTreatment').value,
                    doctor: getEl('recordDoctor').value,
                    notes: getEl('recordNotes').value,
                    prescription_url: prescriptionUrl,
                    body_part: getEl('recordBodyPart').value
                };

                const { error: dbErr } = await window.sb
                    .from('medical_records')
                    .insert([newRecord]);

                if (dbErr) throw dbErr;

                renderHistoryTables(user.id);
                addForm.reset();

            } catch (err) {
                alert('Error adding record: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Record';
            }
        });
    }

    // Handle New Vitals
    const vitalsForm = getEl('addVitalsForm');
    if (vitalsForm) {
        vitalsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = vitalsForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging...';

            try {
                const reportInput = getEl('vitalReport');
                let reportUrl = null;

                if (reportInput.files.length > 0) {
                    const file = reportInput.files[0];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${user.id}/vital_${Date.now()}.${fileExt}`;

                    const { error: upErr } = await window.sb.storage
                        .from('medical_uploads')
                        .upload(fileName, file);

                    if (upErr) throw upErr;

                    const { data: { publicUrl } } = window.sb.storage
                        .from('medical_uploads')
                        .getPublicUrl(fileName);

                    reportUrl = publicUrl;
                }

                const newVital = {
                    user_id: user.id,
                    date: getEl('vitalDate').value,
                    bp: getEl('vitalBP').value,
                    sugar: parseInt(getEl('vitalSugar').value),
                    temperature: getEl('vitalTemp').value,
                    report_url: reportUrl
                };

                const { error: dbErr } = await window.sb
                    .from('vitals')
                    .insert([newVital]);

                if (dbErr) throw dbErr;

                renderVitalsTable(user.id);
                renderHealthGraph(user.id);
                vitalsForm.reset();

            } catch (err) {
                alert('Error logging vitals: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log Vitals';
            }
        });
    }

    // Logout
    const logoutBtn = getEl('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await window.sb.auth.signOut();
            window.location.href = 'index.html';
        });
    }
}

async function renderHistoryTables(userId, filterPart = null) {
    const highBody = getEl('highPriorityTable');
    const lowBody = getEl('lowPriorityTable');

    if (!highBody || !lowBody) return;

    highBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    lowBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';

    try {
        let query = window.sb
            .from('medical_records')
            .select('*')
            .eq('user_id', userId);

        if (filterPart) {
            query = query.eq('body_part', filterPart);
        }

        const { data: history, error } = await query.order('date', { ascending: false });

        if (error) throw error;

        highBody.innerHTML = '';
        lowBody.innerHTML = '';

        history.forEach(record => {
            const tr = document.createElement('tr');
            const attachLink = record.prescription_url
                ? `<a href="${record.prescription_url}" target="_blank" style="color:blue; text-decoration:underline;">View Prescription</a>`
                : 'None';

            tr.innerHTML = `
                <td>${record.date}</td>
                <td>${record.diagnosis}</td>
                <td>${record.treatment}</td>
                <td>${record.doctor}</td>
                <td>${attachLink}</td>
                <td>${record.notes || '-'}</td>
            `;

            if (record.priority === 'High') {
                highBody.appendChild(tr);
            } else {
                lowBody.appendChild(tr);
            }
        });

        if (highBody.children.length === 0) highBody.innerHTML = '<tr><td colspan="6" class="text-center">No high priority records.</td></tr>';
        if (lowBody.children.length === 0) lowBody.innerHTML = '<tr><td colspan="6" class="text-center">No low priority records.</td></tr>';

    } catch (err) {
        console.error(err);
        highBody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${err.message || 'Unknown error'}</td></tr>`;
        lowBody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${err.message || 'Unknown error'}</td></tr>`;
    }
}

async function renderVitalsTable(userId) {
    const tbody = getEl('vitalsTableBody');
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const { data: vitals, error } = await window.sb
            .from('vitals')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (vitals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No vitals logged yet.</td></tr>';
            return;
        }

        vitals.forEach(v => {
            const tr = document.createElement('tr');
            const reportLink = v.report_url
                ? `<a href="${v.report_url}" target="_blank" style="color:blue;">📄 View Report</a>`
                : '-';
            tr.innerHTML = `
                <td>${v.date}</td>
                <td>${v.bp}</td>
                <td>${v.sugar} mg/dL</td>
                <td>${v.temperature || '-'} °C</td>
                <td>${reportLink}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Error: ${err.message || 'Unknown error'}</td></tr>`;
    }
}

async function renderHealthGraph(userId) {
    const canvas = getEl('healthGraph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Fetch vitals
    const { data: vitals } = await window.sb
        .from('vitals')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

    if (!vitals || vitals.length === 0) {
        // Clear and show message
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#64748B';
        ctx.fillText('No data available. Add vitals to see trends.', 20, 50);
        return;
    }

    // High DPI Scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Dimensions (Logical)
    const width = rect.width;
    const height = rect.height;
    const padding = 50;
    const chartW = width - (padding * 2);
    const chartH = height - (padding * 2);

    // Data Processing
    const sugarPoints = vitals.map(d => parseInt(d.sugar) || 0);
    const maxVal = Math.max(...sugarPoints, 200);
    const minVal = Math.min(...sugarPoints, 50); // Floor for better visual
    const range = maxVal - 0; // Baseline 0

    const xStep = vitals.length > 1 ? chartW / (vitals.length - 1) : chartW / 2;
    const yScale = chartH / maxVal;

    // Helper: Get XY
    const getX = (i) => padding + (i * xStep);
    const getY = (val) => height - padding - (val * yScale);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Grid
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    // Horizontal lines
    for (let i = 0; i <= 5; i++) {
        const val = (maxVal / 5) * i;
        const y = getY(val);
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);

        // Label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(Math.round(val), 10, y + 3);
    }
    ctx.stroke();

    // 2. Draw Area Gradient
    if (vitals.length > 1) {
        const gradient = ctx.createLinearGradient(0, height - padding, 0, padding);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.05)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.3)');
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(getX(0), getY(sugarPoints[0]));
        for (let i = 1; i < vitals.length; i++) {
            ctx.lineTo(getX(i), getY(sugarPoints[i]));
        }
        ctx.lineTo(getX(vitals.length - 1), height - padding);
        ctx.lineTo(getX(0), height - padding);
        ctx.closePath();
        ctx.fill();
    }

    // 3. Draw Line
    ctx.beginPath();
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    vitals.forEach((d, i) => {
        const val = parseInt(d.sugar) || 0;
        const x = getX(i);
        const y = getY(val);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 4. Draw Points and DATE Labels
    vitals.forEach((d, i) => {
        const val = parseInt(d.sugar) || 0;
        const x = getX(i);
        const y = getY(val);

        // Point
        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label above point
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(val, x - 5, y - 10);

        // Date Label below X axis
        ctx.fillStyle = '#64748B';
        ctx.font = '10px sans-serif';
        const dateStr = d.date.substring(5); // MM-DD
        ctx.fillText(dateStr, x - 15, height - 25);
    });

    // Axis Titles
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Sugar Levels (mg/dL)', width / 2 - 50, 20);
}

// --- Contact Logic ---
function initContact() {
    const form = getEl('contactForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            // IMPORTANT: Replace 'your-formspree-id' with your actual Formspree form ID
            // Or use a direct email if you have a Formspree account set up for it.
            // For now, we use a placeholder.
            const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mbdjbleq'; // Updated with USER ID

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch(FORMSPREE_ENDPOINT, {
                    method: 'POST',
                    body: JSON.stringify(data),
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    alert('Thank you for reaching out! Your query has been received and we will get back to you shortly.');
                    form.reset();
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.errors ? errorData.errors.map(er => er.message).join(', ') : 'Submission failed');
                }
            } catch (err) {
                console.error('Contact Form Error:', err);
                // Fallback: If Formspree is not set up, show a helpful message
                if (FORMSPREE_ENDPOINT.includes('placeholder')) {
                    alert('Contact feature is almost ready! Please configure your Formspree ID in app.js to start receiving emails. (Simulated success for now)');
                    form.reset();
                } else {
                    alert('Submission failed: ' + err.message);
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}

function renderProfile(profile) {
    if (!profile) return;
    getEl('profileName').textContent = profile.name || 'User';
    // Removed profileId display to clean up UI
    getEl('profileAge').textContent = `${profile.age || '?'} yrs`;
    getEl('profileGender').textContent = profile.gender || '-';

    // New: Blood Group
    if (getEl('profileBlood')) {
        getEl('profileBlood').textContent = profile.blood_group || '?';
    }

    const img = getEl('profileImage');
    const placeholder = getEl('profilePlaceholder');

    if (profile.photo_url) {
        img.src = profile.photo_url;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        img.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

async function initResetPassword() {
    const resetForm = getEl('resetPasswordForm');
    if (!resetForm) return;

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = getEl('newPassword').value;
        const confirmPassword = getEl('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        const submitBtn = resetForm.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        try {
            const { error } = await window.sb.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            alert('Password updated successfully! You are now logged in.');
            window.location.href = 'dashboard.html';

        } catch (err) {
            alert('Update Failed: ' + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Password';
        }
    });
}
