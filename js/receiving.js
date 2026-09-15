function getFilteredInventory() {
    return inventory.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
        if (!searchQuery) return true;
        const matchesId = item.id.toLowerCase().includes(searchQuery);
        const matchesPr = (item.pr || '').toLowerCase().includes(searchQuery);
        const matchesItemName = item.item.toLowerCase().includes(searchQuery);
        const matchesPart = (item.partLabel || '').toLowerCase().includes(searchQuery) || `part ${item.partLabel || ''}`.toLowerCase().includes(searchQuery);
        const matchesDate = item.createdAt.toLowerCase().includes(searchQuery);
        const matchesLocation = item.locations.some(loc =>
            loc.pallet.toLowerCase().includes(searchQuery) ||
            loc.zone.toLowerCase().includes(searchQuery) ||
            (loc.createdAt && loc.createdAt.toLowerCase().includes(searchQuery))
        );
        return matchesId || matchesPr || matchesItemName || matchesPart || matchesDate || matchesLocation;
    });
}

function csvCell(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function downloadReportCsv(rows) {
    const headers = [
        'Transaction ID',
        'PR#',
        'Created At',
        'Item',
        'Part',
        'Item Qty',
        'Assigned Qty',
        'Remaining Qty',
        'Status',
        'Pallet',
        'Zone',
        'Pallet Qty',
        'Assigned At'
    ];

    const csvRows = [headers.map(csvCell).join(',')];
    rows.forEach(({ item }) => {
        const assignedQty = totalAbbr(item);
        const remainingQty = item.qty - assignedQty;
        const status = remainingQty === 0 ? 'Complete' : remainingQty > 0 ? 'Open' : 'Over-assigned';
        const locations = item.locations.length > 0 ? item.locations : [{ pallet: '', zone: '', qty: '', createdAt: '' }];

        locations.forEach(loc => {
            csvRows.push([
                item.id,
                item.pr || '',
                item.createdAt,
                item.item,
                item.partLabel || '',
                item.qty,
                assignedQty,
                remainingQty,
                status,
                loc.pallet,
                loc.zone,
                loc.qty,
                loc.createdAt || ''
            ].map(csvCell).join(','));
        });
    });

    const filenameDate = new Date().toISOString().slice(0, 10);
    const scope = searchQuery ? 'filtered' : 'all';
    downloadTextFile(`stock-received-report-${scope}-${filenameDate}.csv`, csvRows.join('\r\n'), 'text/csv;charset=utf-8');
}

function exportReport() {
    const rows = getFilteredInventory();
    if (rows.length === 0) {
        showAlertModal("There are no transactions to export.", "No Report Data");
        return;
    }

    const reportScope = searchQuery ? 'filtered report' : 'full report';
    showConfirmDialog(
        "Export Report",
        `Export ${rows.length} transaction${rows.length === 1 ? '' : 's'} in the ${reportScope} as a CSV file?`,
        () => downloadReportCsv(rows),
        { confirmText: 'Export', variant: 'primary' }
    );
}

function showAlertModal(message, title = "Required Field") {
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = message;

    const modal = document.getElementById('alert-modal');
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeAlertModal() {
    const modal = document.getElementById('alert-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        modal.classList.remove('flex');
    }, 300);
}

function showConfirmDialog(title, message, onConfirm, options = {}) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    pendingAction = onConfirm;

    const confirmButton = document.getElementById('confirm-yes-btn');
    const confirmIcon = document.getElementById('confirm-icon');
    const isPrimary = options.variant === 'primary';
    confirmButton.innerText = options.confirmText || 'Delete';
    confirmButton.className = isPrimary
        ? 'ripple-btn flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-blue-950/40'
        : 'ripple-btn flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-red-950/40';
    confirmIcon.innerText = isPrimary ? 'CSV' : '!';
    confirmIcon.className = isPrimary
        ? 'w-12 h-12 rounded-full bg-blue-950/60 border border-blue-900/60 flex items-center justify-center mx-auto text-blue-300 font-bold text-lg'
        : 'w-12 h-12 rounded-full bg-red-950/60 border border-red-900/60 flex items-center justify-center mx-auto text-red-400 font-bold text-lg';

    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });

    confirmButton.onclick = function(e) {
        createRipple(e);
        if (pendingAction) pendingAction();
        closeConfirmModal();
    };
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        modal.classList.remove('flex');
        pendingAction = null;
    }, 300);
}

function openImageViewer(src) {
    const modal = document.getElementById('image-viewer-modal');
    document.getElementById('fullscreen-img').src = src;
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeImageViewer() {
    const modal = document.getElementById('image-viewer-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        modal.classList.remove('flex');
    }, 300);
}

// Custom Dropdown Logic
function jsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
}

function renderCustomFormDropdown(id, selectedValue, options, handlerName, placeholder = 'Select', leadingArgs = '') {
    const selected = options.find(option => option.value === selectedValue);
    const label = selected ? selected.label : placeholder;
    const optionHtml = options.map(option => {
        const isSelected = option.value === selectedValue;
        const args = leadingArgs
            ? `${leadingArgs}, '${jsString(id)}', '${jsString(option.value)}', '${jsString(option.label)}', event`
            : `'${jsString(id)}', '${jsString(option.value)}', '${jsString(option.label)}', event`;
        return `
            <button type="button" onclick="${handlerName}(${args})" class="w-full text-left px-3.5 py-2.5 text-xs sm:text-sm ${isSelected ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'} flex items-center justify-between transition-colors rounded-lg">
                <span>${escapeHtml(option.label)}</span>
                ${isSelected ? '<span class="text-blue-400 text-xs font-bold">✓</span>' : ''}
            </button>
        `;
    }).join('');

    return `
        <div class="form-dropdown" onclick="event.stopPropagation()">
            <input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(selectedValue || '')}">
            <div id="custom-dropdown-trigger-${escapeHtml(id)}" onclick="toggleFormDropdown('${jsString(id)}', event)" class="form-dropdown-trigger">
                <span id="custom-dropdown-label-${escapeHtml(id)}" class="form-dropdown-label">${escapeHtml(label)}</span>
                <span id="custom-dropdown-arrow-${escapeHtml(id)}" class="form-dropdown-arrow">⌄</span>
            </div>
            <div id="custom-dropdown-menu-${escapeHtml(id)}" class="custom-dropdown-menu absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 hidden opacity-0 scale-95 overflow-hidden">
                <div class="p-1 space-y-0.5">
                    ${optionHtml || '<div class="px-3.5 py-2.5 text-xs text-slate-500">No options</div>'}
                </div>
            </div>
        </div>
    `;
}

function toggleFormDropdown(id, event) {
    event.stopPropagation();
    const menu = document.getElementById(`custom-dropdown-menu-${id}`);
    const arrow = document.getElementById(`custom-dropdown-arrow-${id}`);
    const trigger = document.getElementById(`custom-dropdown-trigger-${id}`);
    const shell = trigger?.closest('.data-panel, .custom-modal-content, .stock-card');
    if (!menu) return;

    document.querySelectorAll('[id^="custom-dropdown-menu-"]').forEach(openMenu => {
        if (openMenu.id !== `custom-dropdown-menu-${id}`) {
            openMenu.classList.add('hidden', 'opacity-0', 'scale-95');
        }
    });
    document.querySelectorAll('[id^="custom-dropdown-arrow-"]').forEach(openArrow => {
        if (openArrow.id !== `custom-dropdown-arrow-${id}`) {
            openArrow.classList.remove('rotate-180', 'text-blue-400');
        }
    });
    document.querySelectorAll('[id^="custom-dropdown-trigger-"]').forEach(openTrigger => {
        if (openTrigger.id !== `custom-dropdown-trigger-${id}`) {
            openTrigger.classList.remove('active');
        }
    });
    document.querySelectorAll('.dropdown-open').forEach(openShell => {
        if (openShell !== shell) {
            openShell.classList.remove('dropdown-open');
        }
    });

    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
        shell?.classList.add('dropdown-open');
        menu.classList.remove('hidden');
        requestAnimationFrame(() => {
            menu.classList.remove('opacity-0', 'scale-95');
            arrow?.classList.add('rotate-180', 'text-blue-400');
            trigger?.classList.add('active');
        });
    } else {
        closeCustomDropdown(id);
    }
}

function closeCustomDropdown(id) {
    const menu = document.getElementById(`custom-dropdown-menu-${id}`);
    const arrow = document.getElementById(`custom-dropdown-arrow-${id}`);
    const trigger = document.getElementById(`custom-dropdown-trigger-${id}`);
    const shell = trigger?.closest('.data-panel, .custom-modal-content, .stock-card');
    if (menu) {
        menu.classList.add('opacity-0', 'scale-95');
        setTimeout(() => menu.classList.add('hidden'), 200);
    }
    arrow?.classList.remove('rotate-180', 'text-blue-400');
    trigger?.classList.remove('active');
    shell?.classList.remove('dropdown-open');
}

function selectFormDropdown(id, value, label, event) {
    event.stopPropagation();
    selectFormValue(id, value, label);
    closeCustomDropdown(id);
}

function selectFormValue(id, value, label) {
    const input = document.getElementById(id);
    const labelEl = document.getElementById(`custom-dropdown-label-${id}`);
    if (input) input.value = value;
    if (labelEl) labelEl.innerText = label;
}

function selectReportDropdown(field, id, value, label, event) {
    selectFormDropdown(id, value, label, event);
    reportFilters[field] = value;
    renderReport();
}

function selectItemTypeDropdown(id, value, label, event) {
    selectFormDropdown(id, value, label, event);
    syncItemTypeFields();
}

function selectNewPrDropdown(id, value, label, event) {
    selectFormDropdown(id, value, label, event);
    handleNewPrChange();
}

function selectModalItemDropdown(index, id, value, label, event) {
    selectFormDropdown(id, value, label, event);
    handleModalItemChange(index, value);
}

function selectModalPartDropdown(index, id, value, label, event) {
    selectFormDropdown(id, value, label, event);
    updateModalRow(index, 'partLabel', value);
}

function toggleCustomDropdown(index, event) {
    event.stopPropagation();
    const menu = document.getElementById(`custom-dropdown-menu-${index}`);
    const arrow = document.getElementById(`custom-dropdown-arrow-${index}`);
    const card = document.getElementById(`card-${index}`);
    
    // Close all other dropdowns first
    document.querySelectorAll('[id^="custom-dropdown-menu-"]').forEach(m => {
        if (m.id !== `custom-dropdown-menu-${index}`) {
            m.classList.add('hidden', 'opacity-0', 'scale-95');
        }
    });
    document.querySelectorAll('[id^="custom-dropdown-arrow-"]').forEach(a => {
        if (a.id !== `custom-dropdown-arrow-${index}`) {
            a.classList.remove('rotate-180', 'text-blue-400');
        }
    });
    document.querySelectorAll('.stock-card.dropdown-open').forEach(openCard => {
        if (openCard.id !== `card-${index}`) {
            openCard.classList.remove('dropdown-open');
        }
    });

    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
        card?.classList.add('dropdown-open');
        menu.classList.remove('hidden');
        requestAnimationFrame(() => {
            menu.classList.remove('opacity-0', 'scale-95');
            arrow.classList.add('rotate-180', 'text-blue-400');
        });
    } else {
        card?.classList.remove('dropdown-open');
        menu.classList.add('opacity-0', 'scale-95');
        arrow.classList.remove('rotate-180', 'text-blue-400');
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 200);
    }
}

function selectCustomZone(index, zone, event) {
    event.stopPropagation();
    updateTemp(index, 'zone', zone);
    
    const label = document.getElementById(`custom-dropdown-label-${index}`);
    if (label) {
        label.innerText = zone;
    }

    const menu = document.getElementById(`custom-dropdown-menu-${index}`);
    const arrow = document.getElementById(`custom-dropdown-arrow-${index}`);
    const card = document.getElementById(`card-${index}`);
    if (menu) {
        menu.classList.add('opacity-0', 'scale-95');
        setTimeout(() => menu.classList.add('hidden'), 200);
    }
    if (arrow) {
        arrow.classList.remove('rotate-180', 'text-blue-400');
    }
    if (card) {
        card.classList.remove('dropdown-open');
    }

    // Highlight selected option in list
    const options = document.querySelectorAll(`#custom-dropdown-menu-${index} [data-zone]`);
    options.forEach(opt => {
        if (opt.getAttribute('data-zone') === zone) {
            opt.className = 'w-full text-left px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-blue-600/20 text-blue-400 flex items-center justify-between transition-colors';
        } else {
            opt.className = 'w-full text-left px-3.5 py-2.5 text-xs sm:text-sm text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 flex items-center justify-between transition-colors';
        }
    });
}

function closeAllCustomDropdowns(event) {
    closeItemActionMenus();
    document.querySelectorAll('[id^="custom-dropdown-menu-"]').forEach(menu => {
        menu.classList.add('opacity-0', 'scale-95');
        setTimeout(() => menu.classList.add('hidden'), 200);
    });
    document.querySelectorAll('[id^="custom-dropdown-arrow-"]').forEach(arrow => {
        arrow.classList.remove('rotate-180', 'text-blue-400');
    });
    document.querySelectorAll('[id^="custom-dropdown-trigger-"]').forEach(trigger => {
        trigger.classList.remove('active');
    });
    document.querySelectorAll('.dropdown-open').forEach(shell => {
        shell.classList.remove('dropdown-open');
    });
}

function renderInventory() {
    const container = document.getElementById('inventory-list');
    const filteredInventory = getFilteredInventory();

    const resultCount = document.getElementById('result-count');
    if (resultCount) {
        resultCount.textContent = `Showing ${filteredInventory.length} of ${inventory.length} transactions`;
    }

    if (filteredInventory.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <p class="text-slate-400 text-xs sm:text-sm">No matching transactions or items found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    filteredInventory.forEach(({ item, originalIndex }) => {
        container.appendChild(createCardElement(item, originalIndex));
    });
}

function createCardElement(item, index) {
    const rowDiv = document.createElement('div');
    rowDiv.id = `card-${index}`;
    rowDiv.className = getCardClass(item, index);
    rowDiv.innerHTML = getCardHTML(item, index);
    return rowDiv;
}

function getCardClass(item, index) {
    return `stock-card ${item.isExpanded ? 'expanded-card' : ''}`;
}

function getCardHTML(item, index) {
    const totalAssigned = totalAbbr(item);
    const isComplete = totalAssigned === item.qty;
    const pct = item.qty > 0 ? Math.min(100, Math.round((totalAssigned / item.qty) * 100)) : 0;

    const dateParts = item.createdAt.split(' ');
    const dateStr = dateParts[0] || '';
    const timeStr = dateParts[1] || '';

    return `
        <div class="stock-row ${item.isExpanded ? 'row-expanded' : ''}" onclick="toggleExpand(${index})">
            <div class="id-date-cell">
                <span class="accent-line"></span>
                <div class="id-date-content">
                    <span class="transaction-id">${item.id}</span>
                    <span class="date-line">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>
                        ${dateStr}
                    </span>
                    ${timeStr ? `<span class="date-line"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>${timeStr}</span>` : ''}
                </div>
            </div>

            <div class="pr-cell" title="${item.pr || ''}">${item.pr || '—'}</div>

            <div class="item-cell" title="${item.item}${item.partLabel ? ` - Part ${item.partLabel}` : ''}">
                <span class="item-title">${item.item}</span>
                <span class="item-qty">${item.partLabel ? `Part ${item.partLabel} - ` : ''}${item.qty} pcs</span>
            </div>

            <div class="assigned-block">
                <div class="assigned-topline">
                    <span class="assigned-value ${isComplete ? 'complete' : ''}">${totalAssigned}/${item.qty}</span>
                    <span class="assigned-percent">${pct}%</span>
                </div>
                <div class="assigned-progress" aria-label="${pct}% assigned">
                    <span style="width:${pct}%"></span>
                </div>
            </div>

            <div class="row-chevron ${item.isExpanded ? 'expanded' : ''}" aria-hidden="true">›</div>
        </div>

        <div class="accordion-wrapper ${item.isExpanded ? 'expanded' : ''}" onclick="event.stopPropagation()">
            <div class="accordion-inner card-content-target">
                ${getCardInnerHTML(item, index)}
            </div>
        </div>
    `;
}

function getCardInnerHTML(item, index) {
    const totalAssigned = totalAbbr(item);
    const remaining = item.qty - totalAssigned;
    const hasPhotos = item.attachedPhotos && item.attachedPhotos.length > 0;
    const currentZone = item.tempZone || 'A';
    const displayZoneText = currentZone;

    return `
        <div class="mt-4 pt-4 border-t border-slate-800/80 space-y-4">
            
            ${item.locations.length > 0 ? `
                <div class="space-y-2 mb-3">
                    <div class="assignment-header text-[11px] sm:text-xs text-slate-500 font-semibold px-2">
                        <span>#Pallet / Date</span>
                        <span>Zone</span>
                        <span>Qty</span>
                        <span class="text-right">Action</span>
                    </div>
                    <div class="space-y-1.5">
                        ${item.locations.map((loc, locIdx) => `
                            <div class="assignment-row bg-slate-800/60 rounded-xl text-xs sm:text-sm transition-all hover:bg-slate-800">
                                <div class="flex flex-col min-w-0 pr-1">
                                    <span class="text-slate-200 font-medium truncate">${loc.pallet}</span>
                                    <span class="text-[10px] text-slate-400 truncate">${loc.createdAt || ''}</span>
                                </div>
                                <span class="text-slate-200 font-medium bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/60 text-center truncate">${loc.zone}</span>
                                <span class="text-emerald-400 font-semibold truncate text-center">${loc.qty}</span>
                                <div class="text-right flex justify-end">
                                    <button onclick="createRipple(event); confirmRemoveLocation(${index}, ${locIdx})" class="ripple-btn remove-btn text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950 rounded border border-red-900/50 transition-all text-center">Remove</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Custom Dropdown Input Controls Section -->
            <div class="pallet-entry-panel bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 sm:p-4 space-y-3">
                <div class="pallet-entry-grid grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div class="sm:col-span-4 space-y-1">
                        <label class="text-[11px] font-semibold text-slate-400 block">#Pallet</label>
                        <input type="text" id="pallet-input-${index}" value="${item.tempPallet || ''}" oninput="updateTemp(${index}, 'pallet', this.value)" onkeydown="handleKeyDown(event, ${index})" class="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner placeholder-slate-600" placeholder="e.g. P-101">
                    </div>
                    
                    <!-- Custom Dropdown Select Menu -->
                    <div class="sm:col-span-3 space-y-1 relative">
                        <label class="text-[11px] font-semibold text-slate-400 block">Zone</label>
                        <div onclick="toggleCustomDropdown(${index}, event)" class="zone-trigger w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs sm:text-sm flex items-center justify-between cursor-pointer select-none transition-all shadow-inner">
                            <span id="custom-dropdown-label-${index}" class="font-medium">${displayZoneText}</span>
                            <span id="custom-dropdown-arrow-${index}" class="text-slate-400 font-bold transition-transform duration-200">⌄</span>
                        </div>

                        <!-- Dropdown Menu Popover -->
                        <div id="custom-dropdown-menu-${index}" class="custom-dropdown-menu absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 hidden opacity-0 scale-95 overflow-hidden">
                            <div class="p-1 space-y-0.5">
                                ${validZones.map(zone => {
                                    const isSelected = currentZone === zone;
                                    const zoneLabel = zone === 'Loading' ? 'Loading' : `Zone ${zone}`;
                                    return `
                                        <button type="button" data-zone="${zone}" onclick="selectCustomZone(${index}, '${zone}', event)" class="w-full text-left px-3.5 py-2.5 text-xs sm:text-sm ${isSelected ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'} flex items-center justify-between transition-colors rounded-lg">
                                            <span>${zoneLabel}</span>
                                            ${isSelected ? '<span class="text-blue-400 text-xs font-bold">✓</span>' : ''}
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="sm:col-span-4 space-y-1">
                        <label class="text-[11px] font-semibold text-slate-400 block">Qty</label>
                        <input type="number" id="qty-input-${index}" value="${item.tempQty !== undefined && item.tempQty !== '' ? item.tempQty : (remaining > 0 ? remaining : 0)}" oninput="updateTemp(${index}, 'qty', this.value)" onkeydown="handleKeyDown(event, ${index})" class="number-control w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner font-semibold text-emerald-400">
                    </div>

                    <div class="sm:col-span-1 space-y-1">
                        <label class="text-[11px] font-semibold text-slate-400 block opacity-0" aria-hidden="true">Save</label>
                        <button onclick="createRipple(event); addLocation(${index})" class="save-location-btn ripple-btn w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/50 rounded-xl flex items-center justify-center text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-blue-900/30 whitespace-nowrap flex-shrink-0">
                            <span>✓ Save</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Attach Multiple Photos & Remove Transaction Actions -->
            <div class="stock-photo-panel flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 transition-all hover:border-slate-700 mt-3">
                <div class="stock-photo-main flex flex-col sm:flex-row items-start sm:items-center gap-3 overflow-hidden w-full">
                    <input type="file" id="file-input-${index}" accept="image/*" multiple class="hidden" onchange="handlePhotoAttach(event, ${index})">
                    <button onclick="createRipple(event); document.getElementById('file-input-${index}').click()" class="ripple-btn px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-400 bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs flex-shrink-0">
                        📷 Attach Photos
                    </button>
                    
                    <div class="flex flex-wrap items-center gap-2">
                        ${hasPhotos ? item.attachedPhotos.map((photo, pIdx) => {
                            const photoUrl = typeof photo === 'string' ? photo : photo.url;
                            return `
                            <div class="stock-photo-thumb-wrap relative group cursor-pointer" ${photoUrl ? `onclick="openImageViewer('${jsString(photoUrl)}')"` : ''}>
                                ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="Thumbnail ${pIdx + 1}" class="stock-photo-thumb w-10 h-10 object-cover rounded-lg border border-slate-700 hover:border-blue-500 transition">` : '<span class="stock-photo-loading">Loading</span>'}
                                <button onclick="createRipple(event); event.stopPropagation(); confirmRemoveSinglePhoto(${index}, ${pIdx})" class="ripple-btn stock-photo-remove absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow">✕</button>
                            </div>
                        `;
                        }).join('') : `
                            <span class="stock-photo-empty text-xs text-slate-400">No photos attached</span>
                        `}
                    </div>
                </div>

                <div class="stock-photo-actions flex items-center justify-between sm:justify-end space-x-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 flex-shrink-0">
                    ${hasPhotos ? `<button onclick="createRipple(event); confirmRemoveAllPhotos(${index})" class="ripple-btn text-red-400 hover:text-red-300 text-xs transition-colors">Clear All</button>` : ''}
                    <button onclick="createRipple(event); confirmRemoveTransaction(${index})" class="ripple-btn px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 text-xs font-semibold transition-all flex items-center space-x-1">
                        <span>Remove ID</span>
                    </button>
                </div>
            </div>

        </div>
    `;
}

function totalAbbr(item) {
    return item.locations.reduce((sum, loc) => sum + parseInt(loc.qty || 0), 0);
}

function toggleExpand(index) {
    const card = document.getElementById(`card-${index}`);
    if (!card) return;

    const row = card.querySelector('.stock-row');
    const chevron = card.querySelector('.row-chevron');
    const accordion = card.querySelector('.accordion-wrapper');
    const isExpanded = !inventory[index].isExpanded;

    inventory[index].isExpanded = isExpanded;
    card.classList.toggle('expanded-card', isExpanded);
    row?.classList.toggle('row-expanded', isExpanded);
    chevron?.classList.toggle('expanded', isExpanded);
    accordion?.classList.toggle('expanded', isExpanded);

    card.classList.remove('card-click-transition');
    void card.offsetWidth;
    card.classList.add('card-click-transition');
    setTimeout(() => {
        card.classList.remove('card-click-transition');
    }, 300);

    if (isExpanded) {
        setTimeout(() => {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
    }
}

function updateTemp(index, field, value) {
    if (!inventory[index].temp) inventory[index].temp = {};
    inventory[index]['temp' + field.charAt(0).toUpperCase() + field.slice(1)] = value;
}

function addLocation(index) {
    const item = inventory[index];
    const pallet = (item.tempPallet || '').trim();
    const zone = item.tempZone || 'A';
    const totalAssigned = totalAbbr(item);
    const remaining = item.qty - totalAssigned;
    const qty = item.tempQty !== undefined && item.tempQty !== '' ? parseInt(item.tempQty) : remaining;

    if (!pallet) {
        showAlertModal("Please enter a pallet number.");
        return;
    }

    if (Number.isNaN(qty) || qty <= 0) {
        showAlertModal('Assignment quantity must be greater than zero.', 'Quantity Required');
        return;
    }

    if (remaining <= 0) {
        showAlertModal('This receipt line is already fully assigned.', 'Assignment Complete');
        return;
    }

    if (qty > remaining) {
        showAlertModal(`Only ${remaining} ${item.quantityUnit || 'pcs'} remain to be assigned.`, 'Quantity Exceeds Remaining');
        return;
    }

    item.locations.push({ 
        id: createEntityId('assignment'),
        pallet, 
        zone, 
        qty,
        quantityUnit: item.quantityUnit || 'pcs',
        createdAt: getCurrentFormattedDateTime()
    });

    item.tempPallet = '';
    item.tempZone = 'A';
    item.tempQty = '';

    saveInventory();
    renderSecondaryViews();
    renderInventory();
}

function handleKeyDown(event, index) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addLocation(index);
    }
}

function confirmRemoveLocation(itemIdx, locIdx) {
    showConfirmDialog(
        "Remove Pallet Assignment", 
        `Are you sure you want to remove pallet "${inventory[itemIdx].locations[locIdx].pallet}"?`, 
        () => {
            inventory[itemIdx].locations.splice(locIdx, 1);
            saveInventory();
            renderSecondaryViews();
            renderInventory();
        }
    );
}

function confirmRemoveTransaction(index) {
    const target = inventory[index];
    const receiptId = target.receiptId;
    const receiptRows = inventory.filter(item => receiptId ? item.receiptId === receiptId : item === target);
    showConfirmDialog(
        "Delete Transaction", 
        `Are you sure you want to remove transaction "${target.id}" and its ${receiptRows.length} item line${receiptRows.length === 1 ? '' : 's'}?`,
        async () => {
            const photos = receiptRows.flatMap(item => item.attachedPhotos || []).filter(photo => photo && typeof photo === 'object');
            await Promise.all(photos.map(photo => deletePhotoBlob(photo.id).catch(() => false)));
            photos.forEach(revokeAttachmentUrl);
            inventory = inventory.filter(item => receiptId ? item.receiptId !== receiptId : item !== target);
            saveInventory();
            renderSecondaryViews();
            renderInventory();
        }
    );
}

function confirmRemoveSinglePhoto(itemIdx, photoIdx) {
    showConfirmDialog(
        "Remove Photo", 
        "Are you sure you want to remove this photo?", 
        async () => {
            const photo = inventory[itemIdx].attachedPhotos[photoIdx];
            try {
                if (photo && typeof photo === 'object') await deletePhotoBlob(photo.id);
            } catch (error) {
                showAlertModal('The photo could not be removed from browser storage.', 'Photo Storage Error');
                return;
            }
            revokeAttachmentUrl(photo);
            inventory[itemIdx].attachedPhotos.splice(photoIdx, 1);
            saveInventory();
            renderSecondaryViews();
            renderInventory();
        }
    );
}

function confirmRemoveAllPhotos(index) {
    showConfirmDialog(
        "Clear All Photos", 
        "Are you sure you want to remove all attached photos for this item?", 
        async () => {
            const photos = [...inventory[index].attachedPhotos];
            try {
                await Promise.all(photos.filter(photo => photo && typeof photo === 'object').map(photo => deletePhotoBlob(photo.id)));
            } catch (error) {
                showAlertModal('The photos could not be removed from browser storage.', 'Photo Storage Error');
                return;
            }
            photos.forEach(revokeAttachmentUrl);
            inventory[index].attachedPhotos = [];
            saveInventory();
            renderSecondaryViews();
            renderInventory();
        }
    );
}

async function handlePhotoAttach(event, index) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (!inventory[index].attachedPhotos) inventory[index].attachedPhotos = [];

    const addedPhotos = [];
    try {
        for (const file of files) {
            const photo = {
                id: createEntityId('attachment'),
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                createdAt: getCurrentFormattedDateTime(),
                url: URL.createObjectURL(file),
                stored: true
            };
            await writePhotoBlob(photo.id, file);
            inventory[index].attachedPhotos.push(photo);
            addedPhotos.push(photo);
        }
    } catch (error) {
        await Promise.all(addedPhotos.map(photo => deletePhotoBlob(photo.id).catch(() => false)));
        addedPhotos.forEach(photo => {
            revokeAttachmentUrl(photo);
            inventory[index].attachedPhotos = inventory[index].attachedPhotos.filter(entry => entry.id !== photo.id);
        });
        showAlertModal('Photos could not be saved in browser storage.', 'Photo Storage Error');
        return;
    } finally {
        event.target.value = '';
    }

    saveInventory();
    renderSecondaryViews();
    renderInventory();
}

function openNewModal() {
    modalRows = [{ itemId: '', qty: '' }];
    document.getElementById('new-id-input').value = getNextDocumentNumber('FNG', inventory.map(item => item.id));
    renderNewPrOptions();
    const selectedPr = document.getElementById('new-pr-input').value;
    const prItems = getPrItemsForReceiving(selectedPr);
    if (prItems.length > 0) {
        modalRows[0].itemId = prItems[0].itemId;
        modalRows[0].partLabel = (Number.parseInt(prItems[0].partsPerSet || 1, 10) || 1) > 1 ? `1/${prItems[0].partsPerSet}` : '';
    }
    renderModalItemRows();

    const modal = document.getElementById('new-modal');
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeNewModal() {
    const modal = document.getElementById('new-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        modal.classList.remove('flex');
        document.getElementById('new-id-input').value = '';
        document.getElementById('new-pr-input').value = '';
        modalRows = [];
    }, 300);
}

function addModalItemRow() {
    const selectedPr = document.getElementById('new-pr-input').value;
    const prItems = getPrItemsForReceiving(selectedPr);
    if (purchaseRequests.length === 0) {
        showAlertModal("Create a PR in PR List before receiving stock.", "PR Required");
        return;
    }
    if (prItems.length === 0) {
        showAlertModal("This PR has no items. Add items in PR List first.", "No PR Items");
        return;
    }
    const firstItem = prItems[0];
    modalRows.push({
        itemId: firstItem ? firstItem.itemId : '',
        partLabel: firstItem && (Number.parseInt(firstItem.partsPerSet || 1, 10) || 1) > 1 ? `1/${firstItem.partsPerSet}` : '',
        qty: ''
    });
    renderModalItemRows();
}

function confirmRemoveModalItem(index) {
    if (modalRows.length === 1) {
        showAlertModal("You must have at least one item.");
        return;
    }
    const itemName = getReceivingItemName(modalRows[index].itemId) || `Item #${index + 1}`;
    showConfirmDialog(
        "Remove Item",
        `Are you sure you want to remove "${itemName}" from this transaction?`,
        () => {
            modalRows.splice(index, 1);
            renderModalItemRows();
        }
    );
}

function updateModalRow(index, field, value) {
    if (!modalRows[index]) return;
    modalRows[index][field] = value;
    if (modalRows[index].errors) {
        delete modalRows[index].errors[field === 'qty' ? 'qty' : 'item'];
        if (Object.keys(modalRows[index].errors).length === 0) {
            delete modalRows[index].errors;
        }
    }
}

function renderNewPrOptions() {
    const dropdown = document.getElementById('new-pr-dropdown');
    if (!dropdown) return;
    const options = purchaseRequests.map(pr => ({
        value: pr.id,
        label: `${pr.number} - ${pr.items.length} item${pr.items.length === 1 ? '' : 's'}`
    }));
    dropdown.innerHTML = renderCustomFormDropdown('new-pr-input', options[0]?.value || '', options, 'selectNewPrDropdown', 'Select PR');
}

function handleNewPrChange() {
    const selectedPr = document.getElementById('new-pr-input').value;
    const prItems = getPrItemsForReceiving(selectedPr);
    const firstItem = prItems[0];
    modalRows = [{
        itemId: firstItem ? firstItem.itemId : '',
        partLabel: firstItem && (Number.parseInt(firstItem.partsPerSet || 1, 10) || 1) > 1 ? `1/${firstItem.partsPerSet}` : '',
        qty: ''
    }];
    renderModalItemRows();
}

function getPrItemsForReceiving(prId) {
    const pr = purchaseRequests.find(request => request.id === prId);
    return pr ? pr.items : [];
}

function getReceivingItemName(itemId) {
    const masterItem = masterItems.find(item => item.id === itemId);
    if (masterItem) return masterItem.name;
    for (const pr of purchaseRequests) {
        const line = pr.items.find(item => item.itemId === itemId);
        if (line) return line.itemName;
    }
    return '';
}

function getReceivingLine(prId, itemId) {
    const pr = purchaseRequests.find(request => request.id === prId);
    return pr ? pr.items.find(item => item.itemId === itemId) : null;
}

function handleModalItemChange(index, itemId) {
    updateModalRow(index, 'itemId', itemId);
    const selectedPr = document.getElementById('new-pr-input').value;
    const line = getReceivingLine(selectedPr, itemId);
    const partsPerSet = Number.parseInt(line?.partsPerSet || 1, 10) || 1;
    modalRows[index].partLabel = partsPerSet > 1 ? `1/${partsPerSet}` : '';
    renderModalItemRows();
}

function renderModalItemRows() {
    const container = document.getElementById('modal-items-container');
    const selectedPr = document.getElementById('new-pr-input').value;
    const prItems = getPrItemsForReceiving(selectedPr);
    const selectedPrRecord = purchaseRequests.find(request => request.id === selectedPr);

    if (purchaseRequests.length === 0) {
        container.innerHTML = `
            <div class="modal-empty-state">
                <strong>No purchase requests yet</strong>
                Create a PR in PR List before receiving stock.
            </div>
        `;
        return;
    }

    if (prItems.length === 0) {
        container.innerHTML = `
            <div class="modal-empty-state">
                <strong>No items in this PR</strong>
                Add items in PR List first, then return to receiving.
            </div>
        `;
        return;
    }

    const requestedSets = prItems.reduce((sum, line) => sum + (Number.parseInt(line.qty || 0, 10) || 0), 0);
    const receivedSets = prItems.reduce((sum, line) => sum + getReceivedSetsForPrLine(selectedPr, line), 0);
    const summaryHtml = `
        <div class="modal-pr-summary">
            <div>
                <strong>${escapeHtml(selectedPrRecord?.number || selectedPr)}</strong>
                ${escapeHtml(prItems.length)} PR item${prItems.length === 1 ? '' : 's'} selected
            </div>
            <div class="text-right">
                <strong>${escapeHtml(receivedSets)} / ${escapeHtml(requestedSets)}</strong>
                received sets
            </div>
        </div>
    `;

    const rowHtml = modalRows.map((row, idx) => {
        const selectedLine = getReceivingLine(selectedPr, row.itemId) || prItems[0];
        const partsPerSet = Number.parseInt(selectedLine?.partsPerSet || 1, 10) || 1;
        const rowErrors = row.errors || {};
        const itemError = Boolean(rowErrors.item);
        const qtyError = Boolean(rowErrors.qty);
        const requestedQty = selectedLine ? Number.parseInt(selectedLine.qty || 0, 10) || 0 : 0;
        const receivedQty = selectedLine ? getReceivedSetsForPrLine(selectedPr, selectedLine) : 0;
        const remainingQty = requestedQty - receivedQty;

        return `
        <div class="modal-item-card ${itemError || qtyError ? 'has-error' : ''}">
            <div class="modal-item-header">
                <div>
                    <div class="modal-item-title">Item #${idx + 1}</div>
                    <div class="modal-kicker">PR remaining: ${escapeHtml(remainingQty)}</div>
                </div>
                <button onclick="createRipple(event); confirmRemoveModalItem(${idx})" class="ripple-btn modal-remove-btn">Remove</button>
            </div>
            <div class="modal-item-grid">
                <div class="field-group ${itemError ? 'modal-field-error' : ''}">
                    <label class="field-title" for="modal-item-${idx}">Item</label>
                    ${renderCustomFormDropdown(`modal-item-${idx}`, row.itemId, prItems.map(item => ({ value: item.itemId, label: `${item.itemName} - PR qty ${item.qty}` })), 'selectModalItemDropdown', 'Select item', String(idx))}
                    ${itemError ? '<div class="modal-error-text">Select an item.</div>' : ''}
                </div>
                <div class="field-group">
                    <label class="field-title" for="modal-part-${idx}">Part</label>
                    ${partsPerSet > 1 ? `
                        ${renderCustomFormDropdown(`modal-part-${idx}`, row.partLabel || `1/${partsPerSet}`, getPartLabels(partsPerSet).map(part => ({ value: part, label: `Part ${part}` })), 'selectModalPartDropdown', 'Select part', String(idx))}
                    ` : '<div class="modal-static-value">Single</div>'}
                </div>
                <div class="field-group">
                    <label class="field-title">Received Qty</label>
                    <input type="number" value="${row.qty}" oninput="updateModalRow(${idx}, 'qty', this.value)" class="modal-input number-control ${qtyError ? 'modal-input-error' : ''}" placeholder="Enter qty">
                    ${qtyError ? '<div class="modal-error-text">Enter a quantity above 0.</div>' : ''}
                </div>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = summaryHtml + rowHtml;
}

function createNewTransactions() {
    const id = document.getElementById('new-id-input').value.trim();
    const prId = document.getElementById('new-pr-input').value.trim();
    const prRecord = purchaseRequests.find(request => request.id === prId);

    if (!id) {
        showAlertModal("Please enter a Transaction ID.");
        return;
    }

    if (!prRecord) {
        showAlertModal("Please create and select a PR before receiving stock.", "PR Required");
        return;
    }

    if (inventory.some(item => item.id.toLowerCase() === id.toLowerCase())) {
        showAlertModal('This transaction number is already in use.', 'Duplicate Transaction');
        return;
    }

    let hasInvalidRows = false;
    modalRows.forEach(row => {
        const qty = Number.parseInt(row.qty, 10);
        const errors = {};
        if (!row.itemId) errors.item = true;
        if (Number.isNaN(qty) || qty <= 0) errors.qty = true;

        if (Object.keys(errors).length > 0) {
            row.errors = errors;
            hasInvalidRows = true;
        } else {
            delete row.errors;
        }
    });

    if (hasInvalidRows) {
        renderModalItemRows();
        showAlertModal("Please fix the highlighted item rows before creating transactions.", "Check Items");
        return;
    }

    inventory.forEach(i => i.isExpanded = false);

    const creationTimestamp = getCurrentFormattedDateTime();
    const receiptId = createEntityId('receipt');

    [...modalRows].reverse().forEach(row => {
        const selectedLine = getReceivingLine(prId, row.itemId);
        const partsPerSet = Number.parseInt(selectedLine?.partsPerSet || 1, 10) || 1;
        const partLabel = partsPerSet > 1 ? (row.partLabel || `1/${partsPerSet}`) : '';
        inventory.unshift({
            receiptId,
            lineId: createEntityId('receipt-line'),
            id,
            prId,
            pr: prRecord.number,
            createdAt: creationTimestamp,
            prLineId: selectedLine?.lineId || '',
            itemId: row.itemId,
            item: getReceivingItemName(row.itemId),
            partLabel,
            partsPerSet,
            quantityUnit: partsPerSet > 1 ? 'part' : (findMasterItemById(row.itemId)?.unit || 'pcs'),
            qty: parseInt(row.qty),
            isExpanded: false,
            locations: [],
            attachedPhotos: [],
            tempZone: 'A'
        });
    });

    searchQuery = '';
    document.getElementById('search-input').value = '';

    if (inventory.length > 0) {
        inventory[0].isExpanded = true;
    }

    saveInventory();
    renderSecondaryViews();
    closeNewModal();
    renderInventory();

    setTimeout(() => {
        const card = document.getElementById(`card-0`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 150);
}

renderNav();
renderSecondaryViews();
renderInventory();
switchView(currentView);
initializeAttachmentStorage();
