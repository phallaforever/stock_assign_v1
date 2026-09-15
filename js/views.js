function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple');

    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);
}

function getCurrentFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function handleSearch(query) {
    searchQuery = query.toLowerCase().trim();
    renderInventory();
}

function renderPageHeader(title, subtitle) {
    return `
        <div class="page-header">
            <div class="brand-lockup">
                <img src="logo.svg" alt="Stock Received logo" class="app-logo">
                <div class="page-heading">
                    <h1>${escapeHtml(title)}</h1>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
            </div>
        </div>
    `;
}

function renderNav() {
    const navHtml = navItems.map(item => `
        <button type="button" onclick="createRipple(event); switchView('${item.id}')" class="ripple-btn nav-btn ${currentView === item.id ? 'active' : ''}">
            <span class="nav-icon">${renderNavIcon(item.id)}</span>
            <span>${escapeHtml(item.label)}</span>
        </button>
    `).join('');

    const sidebarNav = document.getElementById('sidebar-nav');
    const topbarNav = document.getElementById('topbar-nav');
    if (sidebarNav) sidebarNav.innerHTML = navHtml;
    if (topbarNav) topbarNav.innerHTML = navHtml;
}

function renderNavIcon(viewId) {
    const icons = {
        dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>',
        stock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4-8-4Z"></path><path d="m4 7v10l8 4 8-4V7"></path><path d="M12 11v10"></path></svg>',
        report: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20H2"></path></svg>',
        items: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>',
        prs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"></rect><path d="M9 4V2h6v2"></path><path d="M9 10h6"></path><path d="M9 14h6"></path></svg>'
    };
    return icons[viewId] || '';
}

function switchView(viewId) {
    if (!validViewIds.includes(viewId)) viewId = 'dashboard';
    currentView = viewId;
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.toggle('hidden', section.id !== `view-${viewId}`);
        section.classList.toggle('active', section.id === `view-${viewId}`);
    });
    renderNav();
    renderSecondaryViews();
    if (viewId === 'stock') renderInventory();
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', viewId);
        window.history.replaceState(null, '', url);
    } catch (error) {
        // The active view still works when URL history is unavailable.
    }
}

function statCard(label, value, note = '') {
    return `
        <div class="stat-card">
            <div class="stat-label">${escapeHtml(label)}</div>
            <div class="stat-value">${escapeHtml(value)}</div>
            ${note ? `<div class="stat-note">${escapeHtml(note)}</div>` : ''}
        </div>
    `;
}

function renderDashboard() {
    const container = document.getElementById('view-dashboard');
    if (!container) return;

    const totals = getInventoryTotals();
    const recentRows = inventory.slice(0, 5).map(item => {
        const status = getItemStatus(item);
        return `
            <tr>
                <td class="data-code">${escapeHtml(item.id)}</td>
                <td class="data-code">${escapeHtml(item.pr || '-')}</td>
                <td>${escapeHtml(item.item)}</td>
                <td class="data-number">${escapeHtml(item.qty)}</td>
                <td class="data-number">${escapeHtml(totalAbbr(item))}</td>
                <td>${statusPill(status)}</td>
            </tr>
        `;
    }).join('');

    const zoneRows = getZoneSummary().map(row => `
        <tr>
            <td>${escapeHtml(row.zone)}</td>
            <td class="data-number">${escapeHtml(row.qty)}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        ${renderPageHeader('Dashboard', 'Track stock receiving, assignment progress, and warehouse zones')}
        <div class="stat-grid">
            ${statCard('Transactions', inventory.length, `${purchaseRequests.length} PRs / ${totals.uniqueItems} item types`)}
            ${statCard('Received Qty', totals.totalQty, `${totals.completeItems} completed lines`)}
            ${statCard('Assigned Qty', totals.assignedQty, 'Placed in warehouse zones')}
            ${statCard('Remaining Qty', totals.remainingQty, totals.overItems ? `${totals.overItems} lines need review` : 'No over-assigned lines')}
        </div>
        <div class="data-panel">
            <div class="panel-header">
                <div>
                    <div class="panel-title">Recent Stock Received</div>
                    <div class="panel-subtitle">Latest transactions by entry order</div>
                </div>
            </div>
            <div class="data-table-wrap">
                <table class="data-table dashboard-recent-table">
                    <thead><tr><th>ID</th><th>PR#</th><th>Item</th><th class="data-number">Qty</th><th class="data-number">Assigned</th><th>Status</th></tr></thead>
                    <tbody>${recentRows || '<tr><td colspan="6">No stock received yet.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <div class="data-panel">
            <div class="panel-header">
                <div>
                    <div class="panel-title">Zone Usage Summary</div>
                    <div class="panel-subtitle">Assigned quantity by warehouse zone</div>
                </div>
            </div>
            <div class="data-table-wrap">
                <table class="data-table dashboard-zone-table">
                    <thead><tr><th>Zone</th><th class="data-number">Assigned Qty</th></tr></thead>
                    <tbody>${zoneRows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function getReportRows() {
    return inventory.filter(item => {
        const status = getItemStatus(item);
        const zoneMatch = !reportFilters.zone || item.locations.some(loc => loc.zone === reportFilters.zone);
        const prMatch = !reportFilters.pr || (item.pr || '') === reportFilters.pr;
        const statusMatch = !reportFilters.status || status === reportFilters.status;
        return zoneMatch && prMatch && statusMatch;
    });
}

function updateReportFilter(field, value) {
    reportFilters[field] = value;
    renderReport();
}

function exportReportView() {
    const rows = getReportRows().map((item, originalIndex) => ({ item, originalIndex }));
    if (rows.length === 0) {
        showAlertModal('There are no report rows to export.', 'No Report Data');
        return;
    }
    showConfirmDialog(
        'Export Report',
        `Export ${rows.length} report row${rows.length === 1 ? '' : 's'} as a CSV file?`,
        () => downloadReportCsv(rows),
        { confirmText: 'Export', variant: 'primary' }
    );
}

function handleItemMasterSearch(value) {
    itemMasterFilters.search = String(value || '');
    renderItemList();
    const input = document.getElementById('item-master-search');
    if (input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
    }
}

function selectItemMasterFilterDropdown(field, id, value, label, event) {
    selectFormDropdown(id, value, label, event);
    itemMasterFilters[field] = value;
    renderItemList();
}

function renderItemActionMenu(item) {
    return `
        <div id="item-action-menu-${escapeHtml(item.id)}" class="item-action-menu hidden" onclick="event.stopPropagation()">
            <button type="button" onclick="viewMasterItem('${jsString(item.id)}')" class="item-menu-btn">View Details</button>
            <button type="button" onclick="openItemModal('${jsString(item.id)}')" class="item-menu-btn">Edit Item</button>
            <button type="button" onclick="confirmRemoveMasterItem('${jsString(item.id)}')" class="item-menu-btn danger">Delete</button>
        </div>
    `;
}

function closeItemActionMenus() {
    document.querySelectorAll('.item-action-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
    document.querySelectorAll('.item-action-menu-open').forEach(panel => {
        panel.classList.remove('item-action-menu-open', 'dropdown-open');
    });
    openItemActionMenuId = null;
}

function toggleItemActionMenu(itemId, event) {
    event.stopPropagation();
    const menu = document.getElementById(`item-action-menu-${itemId}`);
    if (!menu) return;
    const panel = menu.closest('.data-panel');
    const shouldOpen = menu.classList.contains('hidden') || openItemActionMenuId !== itemId;
    closeItemActionMenus();
    if (shouldOpen) {
        menu.classList.remove('hidden');
        panel?.classList.add('item-action-menu-open', 'dropdown-open');
        openItemActionMenuId = itemId;
    }
}

function viewMasterItem(itemId) {
    const item = masterItems.find(masterItem => masterItem.id === itemId);
    if (!item) return;
    closeItemActionMenus();
    const stock = getItemRows().find(row => row.item.toLowerCase() === item.name.toLowerCase());
    showAlertModal(
        `SKU: ${item.sku}\nCategory: ${item.category}\nUnit: ${item.unit}\nType: ${item.itemType}${item.partsPerSet > 1 ? ` (${item.partsPerSet} parts)` : ''}\nPR Sets: ${stock ? stock.requested : 0}\nRemaining: ${stock ? stock.remaining : 0}`,
        item.name
    );
}

function renderReport() {
    const container = document.getElementById('view-report');
    if (!container) return;

    const prOptions = Array.from(new Set(inventory.map(item => item.pr).filter(Boolean))).sort();
    const rows = getReportRows();
    const totals = getInventoryTotals(rows);
    const rowHtml = rows.map(item => {
        const status = getItemStatus(item);
        return `
            <tr>
                <td class="data-code">${escapeHtml(item.id)}</td>
                <td class="data-code">${escapeHtml(item.pr || '-')}</td>
                <td>${escapeHtml(item.createdAt)}</td>
                <td>${escapeHtml(item.item)}</td>
                <td>${escapeHtml(item.partLabel || '-')}</td>
                <td class="data-number">${escapeHtml(item.qty)}</td>
                <td class="data-number">${escapeHtml(totalAbbr(item))}</td>
                <td class="data-number">${escapeHtml(item.qty - totalAbbr(item))}</td>
                <td>${statusPill(status)}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        ${renderPageHeader('Report', 'Filter stock receiving records and export CSV reports')}
        <div class="data-panel">
            <div class="panel-header">
                <div>
                    <div class="panel-title">Report Filters</div>
                    <div class="panel-subtitle">${rows.length} matching transaction${rows.length === 1 ? '' : 's'}</div>
                </div>
                <button onclick="createRipple(event); exportReportView()" class="ripple-btn toolbar-export-btn" aria-label="Export filtered report">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
                    <span>Export Report</span>
                </button>
            </div>
            <div class="p-4 report-filters">
                <div class="field-group">
                    <label class="field-title" for="report-pr-filter">PR Number</label>
                    ${renderCustomFormDropdown('report-pr-filter', reportFilters.pr, [{ value: '', label: 'All PR#' }, ...prOptions.map(pr => ({ value: pr, label: pr }))], 'selectReportDropdown', 'All PR#', "'pr'")}
                </div>
                <div class="field-group">
                    <label class="field-title" for="report-zone-filter">Zone</label>
                    ${renderCustomFormDropdown('report-zone-filter', reportFilters.zone, [{ value: '', label: 'All Zones' }, ...validZones.map(zone => ({ value: zone, label: zone === 'Loading' ? 'Loading' : `Zone ${zone}` }))], 'selectReportDropdown', 'All Zones', "'zone'")}
                </div>
                <div class="field-group">
                    <label class="field-title" for="report-status-filter">Status</label>
                    ${renderCustomFormDropdown('report-status-filter', reportFilters.status, [{ value: '', label: 'All Status' }, ...['Open', 'Complete', 'Over-assigned'].map(status => ({ value: status, label: status }))], 'selectReportDropdown', 'All Status', "'status'")}
                </div>
                <button onclick="createRipple(event); reportFilters = { pr: '', zone: '', status: '' }; renderReport()" class="ripple-btn filter-action-btn secondary" aria-label="Reset filters">
                    <svg class="filter-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path></svg>
                    <span>Reset Filters</span>
                </button>
            </div>
        </div>
        <div class="stat-grid">
            ${statCard('Rows', rows.length, 'Filtered records')}
            ${statCard('Received Qty', totals.totalQty)}
            ${statCard('Assigned Qty', totals.assignedQty)}
            ${statCard('Remaining Qty', totals.remainingQty)}
        </div>
        <div class="data-panel">
            <div class="data-table-wrap">
                <table class="data-table">
                    <thead><tr><th>ID</th><th>PR#</th><th>Date</th><th>Item</th><th>Part</th><th class="data-number">Qty</th><th class="data-number">Assigned</th><th class="data-number">Remain</th><th>Status</th></tr></thead>
                    <tbody>${rowHtml || '<tr><td colspan="9">No report data for these filters.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderItemList() {
    const container = document.getElementById('view-items');
    if (!container) return;

    const stockRows = getItemRows();
    const categoryOptions = Array.from(new Set(masterItems.map(item => item.category).filter(Boolean))).sort();
    const filteredItems = masterItems.filter(item => {
        const stock = stockRows.find(row => row.item.toLowerCase() === item.name.toLowerCase());
        const query = itemMasterFilters.search.toLowerCase().trim();
        const searchMatch = !query
            || item.name.toLowerCase().includes(query)
            || item.sku.toLowerCase().includes(query)
            || item.category.toLowerCase().includes(query);
        const categoryMatch = !itemMasterFilters.category || item.category === itemMasterFilters.category;
        const typeMatch = !itemMasterFilters.type || item.itemType === itemMasterFilters.type;
        return searchMatch && categoryMatch && typeMatch;
    });
    const itemRows = filteredItems.map(item => {
        const stock = stockRows.find(row => row.item.toLowerCase() === item.name.toLowerCase());
        const typeText = item.partsPerSet > 1 ? `${item.itemType} - ${item.partsPerSet} parts` : item.itemType;
        return `
        <tr>
            <td>
                <div class="item-main-cell">
                    <span class="item-main-name">${escapeHtml(item.name)}</span>
                    <span class="item-main-unit">Unit: ${escapeHtml(item.unit)}</span>
                </div>
            </td>
            <td><span class="item-code">${escapeHtml(item.sku)}</span></td>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(typeText)}</td>
            <td class="data-number">${escapeHtml(stock ? stock.requested : 0)}</td>
            <td class="data-number">${escapeHtml(stock ? stock.received : 0)}</td>
            <td class="data-number">${escapeHtml(stock ? stock.remaining : 0)}</td>
            <td>${statusPill(stock ? stock.status : 'Open')}</td>
            <td class="item-action-cell">
                <button onclick="createRipple(event); toggleItemActionMenu('${jsString(item.id)}', event)" class="ripple-btn item-action-btn" aria-label="Item actions" title="Item actions">...</button>
                ${renderItemActionMenu(item)}
            </td>
        </tr>
        `;
    }).join('');
    const mobileCards = filteredItems.map(item => {
        const stock = stockRows.find(row => row.item.toLowerCase() === item.name.toLowerCase());
        const typeText = item.partsPerSet > 1 ? `${item.itemType} - ${item.partsPerSet} parts` : item.itemType;
        return `
            <div class="item-mobile-card">
                <div class="item-mobile-card-head">
                    <div class="item-main-cell">
                        <span class="item-main-name">${escapeHtml(item.name)}</span>
                        <span class="item-code">${escapeHtml(item.sku)}</span>
                    </div>
                    <div class="item-action-cell">
                        <button onclick="createRipple(event); toggleItemActionMenu('${jsString(item.id)}', event)" class="ripple-btn item-action-btn" aria-label="Item actions" title="Item actions">...</button>
                        ${renderItemActionMenu(item)}
                    </div>
                </div>
                <div class="item-mobile-meta">
                    <div>
                        <div class="item-mobile-label">Category</div>
                        <div class="item-mobile-value">${escapeHtml(item.category)}</div>
                    </div>
                    <div>
                        <div class="item-mobile-label">Type</div>
                        <div class="item-mobile-value">${escapeHtml(typeText)}</div>
                    </div>
                    <div>
                        <div class="item-mobile-label">Unit</div>
                        <div class="item-mobile-value">${escapeHtml(item.unit)}</div>
                    </div>
                </div>
                <div class="item-mobile-stats">
                    <div class="item-mobile-stat">
                        <div class="item-mobile-label">PR</div>
                        <div class="item-mobile-value">${escapeHtml(stock ? stock.requested : 0)}</div>
                    </div>
                    <div class="item-mobile-stat">
                        <div class="item-mobile-label">Received</div>
                        <div class="item-mobile-value">${escapeHtml(stock ? stock.received : 0)}</div>
                    </div>
                    <div class="item-mobile-stat">
                        <div class="item-mobile-label">Remain</div>
                        <div class="item-mobile-value">${escapeHtml(stock ? stock.remaining : 0)}</div>
                    </div>
                </div>
                <div>${statusPill(stock ? stock.status : 'Open')}</div>
            </div>
        `;
    }).join('');
    const totals = stockRows.reduce((summary, row) => {
        summary.requested += row.requested;
        summary.received += row.received;
        summary.remaining += row.remaining;
        return summary;
    }, { requested: 0, received: 0, remaining: 0 });

    container.innerHTML = `
        ${renderPageHeader('Item Master', 'Manage items used throughout procurement')}
        <div class="stat-grid">
            ${statCard('Total Items', masterItems.length, 'Master records')}
            ${statCard('PR Sets', totals.requested, 'Requested sets')}
            ${statCard('Received', totals.received, 'Received sets')}
            ${statCard('Remaining', totals.remaining, 'Open sets')}
        </div>
        <div class="data-panel">
            <div class="panel-header">
                <div>
                    <div class="panel-title">Items</div>
                    <div class="panel-subtitle">${filteredItems.length} of ${masterItems.length} item${masterItems.length === 1 ? '' : 's'} shown</div>
                </div>
                <button onclick="createRipple(event); openItemModal()" class="ripple-btn filter-action-btn primary item-create-btn" aria-label="Create new item">
                    <svg class="filter-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                    <span>New Item</span>
                </button>
            </div>
            <div class="item-master-toolbar">
                <div class="field-group">
                    <label class="field-title" for="item-master-search">Search</label>
                    <input id="item-master-search" class="filter-control" value="${escapeHtml(itemMasterFilters.search)}" oninput="handleItemMasterSearch(this.value)" placeholder="Search by item name or SKU...">
                </div>
                <div class="field-group">
                    <label class="field-title" for="item-category-filter">Category</label>
                    ${renderCustomFormDropdown('item-category-filter', itemMasterFilters.category, [{ value: '', label: 'All Categories' }, ...categoryOptions.map(category => ({ value: category, label: category }))], 'selectItemMasterFilterDropdown', 'All Categories', "'category'")}
                </div>
                <div class="field-group">
                    <label class="field-title" for="item-type-filter">Type</label>
                    ${renderCustomFormDropdown('item-type-filter', itemMasterFilters.type, [{ value: '', label: 'All Types' }, { value: 'Single', label: 'Single' }, { value: 'Set', label: 'Set' }], 'selectItemMasterFilterDropdown', 'All Types', "'type'")}
                </div>
                <button onclick="createRipple(event); itemMasterFilters = { search: '', category: '', type: '' }; renderItemList()" class="ripple-btn filter-action-btn secondary" aria-label="Reset item filters">
                    <svg class="filter-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path></svg>
                    <span>Reset</span>
                </button>
            </div>
            <div class="data-table-wrap item-master-table-wrap">
                <table class="data-table item-master-table">
                    <thead><tr><th>Item</th><th>SKU</th><th>Category</th><th>Type</th><th class="data-number">PR</th><th class="data-number">Received</th><th class="data-number">Remaining</th><th>Status</th><th></th></tr></thead>
                    <tbody>${itemRows || '<tr><td colspan="9">No items match these filters.</td></tr>'}</tbody>
                </table>
            </div>
            <div class="item-mobile-list">${mobileCards || '<div class="modal-empty-state">No items match these filters.</div>'}</div>
        </div>
    `;
}

function renderPrList() {
    const container = document.getElementById('view-prs');
    if (!container) return;

    const rows = getPrRows();
    const detailHtml = row => {
        const lines = row.lines.map(line => {
            const requested = Number.parseInt(line.qty || 0, 10) || 0;
            const received = getReceivedSetsForPrLine(row.id, line);
            const unit = line.itemType === 'Set' ? 'set' : (line.unit || findMasterItemById(line.itemId)?.unit || 'pcs');
            const sku = findMasterItemById(line.itemId)?.sku || '';
            return `
                <div class="pr-detail-line">
                    <div class="pr-detail-item">
                        ${escapeHtml(line.itemName)}
                        <small>${escapeHtml(sku || 'No SKU')}</small>
                    </div>
                    <div class="pr-detail-metric"><span>Requested</span><strong>${escapeHtml(requested)}</strong></div>
                    <div class="pr-detail-metric"><span>Received</span><strong>${escapeHtml(received)}</strong></div>
                    <div class="pr-detail-metric"><span>Unit</span><strong>${escapeHtml(unit)}</strong></div>
                </div>
            `;
        }).join('');
        return `<div class="pr-detail-panel"><div class="pr-detail-heading">Requested items</div>${lines}</div>`;
    };
    const rowHtml = rows.map(row => {
        const expanded = expandedPrIds.has(row.id);
        return `
            <tr>
                <td class="data-code">${escapeHtml(row.pr)}</td>
                <td class="data-number">${escapeHtml(row.items)}</td>
                <td class="data-number">${escapeHtml(row.requested)}</td>
                <td class="data-number">${escapeHtml(row.received)}</td>
                <td class="data-number">${escapeHtml(row.assigned)}</td>
                <td class="data-number">${escapeHtml(row.remaining)}</td>
                <td>${escapeHtml(row.createdAt)}</td>
                <td>${statusPill(row.status)}</td>
                <td>
                    <div class="pr-row-actions">
                        <button type="button" onclick="createRipple(event); togglePrDetails('${jsString(row.id)}')" class="ripple-btn pr-action-btn" aria-expanded="${expanded}">${expanded ? 'Hide' : 'View'}</button>
                        <button type="button" onclick="createRipple(event); openPurchaseRequestModal('${jsString(row.id)}')" class="ripple-btn pr-action-btn primary">Add items</button>
                        <button type="button" onclick="createRipple(event); confirmRemovePurchaseRequest('${jsString(row.pr)}')" class="ripple-btn pr-action-btn danger">Remove</button>
                    </div>
                </td>
            </tr>
            ${expanded ? `<tr class="pr-detail-row"><td colspan="9">${detailHtml(row)}</td></tr>` : ''}
        `;
    }).join('');
    const mobileCards = rows.map(row => {
        const expanded = expandedPrIds.has(row.id);
        return `
            <article class="pr-mobile-card">
                <div class="pr-mobile-head">
                    <div>
                        <div class="pr-mobile-number">${escapeHtml(row.pr)}</div>
                        <div class="item-main-unit">${escapeHtml(row.createdAt)} · ${escapeHtml(row.items)} item${row.items === 1 ? '' : 's'}</div>
                    </div>
                    ${statusPill(row.status)}
                </div>
                <div class="pr-mobile-stats">
                    <div class="pr-mobile-stat"><div class="item-mobile-label">Requested</div><div class="item-mobile-value">${escapeHtml(row.requested)}</div></div>
                    <div class="pr-mobile-stat"><div class="item-mobile-label">Received</div><div class="item-mobile-value">${escapeHtml(row.received)}</div></div>
                    <div class="pr-mobile-stat"><div class="item-mobile-label">Remaining</div><div class="item-mobile-value">${escapeHtml(row.remaining)}</div></div>
                </div>
                <div class="pr-mobile-actions">
                    <button type="button" onclick="createRipple(event); togglePrDetails('${jsString(row.id)}')" class="ripple-btn pr-action-btn" aria-expanded="${expanded}">${expanded ? 'Hide details' : 'View details'}</button>
                    <button type="button" onclick="createRipple(event); openPurchaseRequestModal('${jsString(row.id)}')" class="ripple-btn pr-action-btn primary">Add items</button>
                    <button type="button" onclick="createRipple(event); confirmRemovePurchaseRequest('${jsString(row.pr)}')" class="ripple-btn pr-action-btn danger">Remove</button>
                </div>
                ${expanded ? detailHtml(row) : ''}
            </article>
        `;
    }).join('');

    container.innerHTML = `
        ${renderPageHeader('PR List', 'Create purchase requests from Item List before receiving stock')}
        <div class="data-panel">
            <div class="panel-header pr-list-header">
                <div>
                    <div class="panel-title">Purchase Requests</div>
                    <div class="panel-subtitle">${purchaseRequests.length} PR record${purchaseRequests.length === 1 ? '' : 's'} available for receiving</div>
                </div>
                <button type="button" onclick="createRipple(event); openPurchaseRequestModal()" class="ripple-btn filter-action-btn primary" aria-label="Create new purchase request">
                    <svg class="filter-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                    <span>New PR</span>
                </button>
            </div>
            <div class="data-table-wrap pr-table-wrap">
                <table class="data-table">
                    <thead><tr><th>PR#</th><th class="data-number">Items</th><th class="data-number">Requested</th><th class="data-number">Received</th><th class="data-number">Assigned</th><th class="data-number">Remaining</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>${rowHtml || '<tr><td colspan="9">No PR records yet.</td></tr>'}</tbody>
                </table>
            </div>
            <div class="pr-mobile-list">${mobileCards || '<div class="modal-empty-state">No PR records yet. Create your first PR to begin receiving stock.</div>'}</div>
        </div>
    `;
}

function togglePrDetails(prId) {
    if (expandedPrIds.has(prId)) expandedPrIds.delete(prId);
    else expandedPrIds.add(prId);
    renderPrList();
}

function renderSecondaryViews() {
    renderDashboard();
    renderReport();
    renderItemList();
    renderPrList();
}
