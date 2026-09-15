function syncItemTypeFields() {
    const typeInput = document.getElementById('item-type-input');
    const partsInput = document.getElementById('item-parts-input');
    const partsField = document.getElementById('item-parts-field');
    if (!typeInput || !partsInput) return;

    const isSet = typeInput.value === 'Set';
    partsField?.classList.toggle('hidden', !isSet);
    partsInput.disabled = !isSet;
    partsInput.min = isSet ? '2' : '1';
    if (!isSet) {
        partsInput.value = '1';
    } else if (!partsInput.value || Number.parseInt(partsInput.value, 10) < 2) {
        partsInput.value = '2';
    }
}

function saveItemFromModal() {
    const nameInput = document.getElementById('item-name-input');
    const skuInput = document.getElementById('item-sku-input');
    const unitInput = document.getElementById('item-unit-input');
    const categoryInput = document.getElementById('item-category-input');
    const typeInput = document.getElementById('item-type-input');
    const partsInput = document.getElementById('item-parts-input');
    const name = (nameInput?.value || '').trim();
    const sku = (skuInput?.value || '').trim();
    const itemType = typeInput?.value === 'Set' ? 'Set' : 'Single';
    const partsPerSet = itemType === 'Set' ? Number.parseInt(partsInput?.value || 1, 10) : 1;

    if (!name) {
        showAlertModal('Please enter an item name.', 'Item Required');
        return;
    }
    if (!sku) {
        showAlertModal('Please enter a SKU or item code.', 'SKU Required');
        return;
    }
    if (masterItems.some(item => item.id !== editingItemId && item.name.toLowerCase() === name.toLowerCase())) {
        showAlertModal('This item already exists in Item List.', 'Duplicate Item');
        return;
    }
    if (masterItems.some(item => item.id !== editingItemId && item.sku.toLowerCase() === sku.toLowerCase())) {
        showAlertModal('This SKU or item code is already in use.', 'Duplicate SKU');
        return;
    }
    if (itemType === 'Set' && (Number.isNaN(partsPerSet) || partsPerSet < 2)) {
        showAlertModal('Set items need at least 2 parts per set.', 'Parts Required');
        return;
    }

    const existingItem = editingItemId ? masterItems.find(item => item.id === editingItemId) : null;
    const nextItem = {
        id: existingItem?.id || createEntityId('item'),
        name,
        sku,
        unit: (unitInput?.value || 'pcs').trim(),
        category: (categoryInput?.value || 'General').trim(),
        itemType,
        partsPerSet,
        isActive: existingItem?.isActive !== false,
        createdAt: existingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (existingItem) {
        masterItems = masterItems.map(item => item.id === existingItem.id ? nextItem : item);
    } else {
        masterItems.push(nextItem);
    }

    saveMasterItems();
    nameInput.value = '';
    if (skuInput) skuInput.value = '';
    selectFormValue('item-unit-input', 'pcs', 'pcs');
    selectFormValue('item-category-input', 'Aluminum', 'Aluminum');
    selectFormValue('item-type-input', 'Single', 'Single Item');
    if (partsInput) partsInput.value = '1';
    syncItemTypeFields();
    closeItemModal();
    renderSecondaryViews();
    renderInventory();
    showAlertModal(
        existingItem ? `"${name}" has been updated.` : `"${name}" has been added to Item Master.`,
        existingItem ? 'Item Updated' : 'Item Created'
    );
}

function confirmRemoveMasterItem(itemId) {
    closeItemActionMenus();
    const item = masterItems.find(masterItem => masterItem.id === itemId);
    if (!item) return;

    const prUsage = purchaseRequests.filter(pr => pr.items.some(line => line.itemId === itemId)).length;
    const stockUsage = inventory.filter(stock => stock.itemId === itemId || stock.item.toLowerCase() === item.name.toLowerCase()).length;

    if (prUsage > 0 || stockUsage > 0) {
        showAlertModal(
            `This item is used in ${prUsage} PR record${prUsage === 1 ? '' : 's'} and ${stockUsage} stock received record${stockUsage === 1 ? '' : 's'}. Remove those records first.`,
            'Cannot Remove Item'
        );
        return;
    }

    showConfirmDialog(
        'Remove Item Master',
        `Are you sure you want to remove "${item.name}" from Item Master?`,
        () => {
            masterItems = masterItems.filter(masterItem => masterItem.id !== itemId);
            saveMasterItems();
            renderSecondaryViews();
        }
    );
}

function getPrItemPickerLabel(item) {
    return item ? `${item.sku} — ${item.name}` : '';
}

function findPrPickerItem(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    return masterItems.find(item => {
        return getPrItemPickerLabel(item).toLowerCase() === normalized
            || item.sku.toLowerCase() === normalized
            || item.name.toLowerCase() === normalized;
    }) || null;
}

function showToast(message) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function setPrModalGeneralError(message = '') {
    const error = document.getElementById('pr-modal-general-error');
    if (!error) return;
    error.textContent = message;
    error.classList.toggle('hidden', !message);
}

function setPrModalNumberError(message = '') {
    const error = document.getElementById('pr-modal-number-error');
    const input = document.getElementById('pr-modal-number-input');
    if (error) {
        error.textContent = message;
        error.classList.toggle('hidden', !message);
    }
    input?.classList.toggle('modal-input-error', Boolean(message));
}

function clearPrModalNumberError() {
    setPrModalNumberError('');
    setPrModalGeneralError('');
}

function openPurchaseRequestModal(prId = '') {
    if (masterItems.length === 0) {
        showAlertModal('Create an item in Item Master before creating a purchase request.', 'Item Required');
        return;
    }

    const target = purchaseRequests.find(pr => pr.id === prId);
    prModalMode = target ? 'append' : 'create';
    prModalTargetId = target?.id || '';
    prModalRows = [{ itemId: '', itemQuery: '', qty: '', errors: {} }];

    const numberInput = document.getElementById('pr-modal-number-input');
    const numberWrap = document.getElementById('pr-modal-number-wrap');
    const title = document.getElementById('pr-modal-title');
    const kicker = document.getElementById('pr-modal-kicker');
    const submitLabel = document.querySelector('#pr-modal-submit span');
    const nextNumber = getNextDocumentNumber('PR', purchaseRequests.map(pr => pr.number));

    if (numberInput) {
        numberInput.value = target?.number || nextNumber;
        numberInput.disabled = Boolean(target);
    }
    numberWrap?.classList.toggle('is-locked', Boolean(target));
    if (title) title.textContent = target ? `Add Items to ${target.number}` : 'Create New PR';
    if (kicker) kicker.textContent = target
        ? 'Add requested quantities without changing the original PR number'
        : 'Add one or more requested items before saving';
    if (submitLabel) submitLabel.textContent = target ? 'Add Items' : 'Create PR';

    setPrModalNumberError('');
    setPrModalGeneralError('');
    renderPrModalRows();

    const modal = document.getElementById('pr-modal');
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.add('active');
        setTimeout(() => (target
            ? document.getElementById('pr-modal-item-0')
            : numberInput)?.focus(), 80);
    });
}

function closePurchaseRequestModal() {
    const modal = document.getElementById('pr-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        modal.classList.remove('flex');
        prModalRows = [];
        prModalMode = 'create';
        prModalTargetId = '';
    }, 300);
}

function addPrModalRow() {
    prModalRows.push({ itemId: '', itemQuery: '', qty: '', errors: {} });
    renderPrModalRows();
    setTimeout(() => document.getElementById(`pr-modal-item-${prModalRows.length - 1}`)?.focus(), 0);
}

function removePrModalRow(index) {
    if (prModalRows.length === 1) return;
    prModalRows.splice(index, 1);
    renderPrModalRows();
}

function updatePrModalItem(index, value) {
    const row = prModalRows[index];
    if (!row) return;
    const item = findPrPickerItem(value);
    row.itemQuery = value;
    row.itemId = item?.id || '';
    if (row.errors) delete row.errors.item;
    const input = document.getElementById(`pr-modal-item-${index}`);
    input?.classList.remove('modal-input-error');
    const error = document.getElementById(`pr-modal-item-error-${index}`);
    error?.classList.add('hidden');
    const unit = document.getElementById(`pr-modal-unit-${index}`);
    if (unit) unit.textContent = item ? (item.itemType === 'Set' ? 'set' : item.unit) : '—';
}

function updatePrModalQty(index, value) {
    const row = prModalRows[index];
    if (!row) return;
    row.qty = value;
    if (row.errors) delete row.errors.qty;
    const input = document.getElementById(`pr-modal-qty-${index}`);
    input?.classList.remove('modal-input-error');
    const error = document.getElementById(`pr-modal-qty-error-${index}`);
    error?.classList.add('hidden');
}

function renderPrModalRows() {
    const options = document.getElementById('pr-modal-item-options');
    if (options) {
        options.innerHTML = masterItems
            .filter(item => item.isActive !== false)
            .map(item => `<option value="${escapeHtml(getPrItemPickerLabel(item))}"></option>`)
            .join('');
    }

    const container = document.getElementById('pr-modal-items-container');
    if (!container) return;
    container.innerHTML = prModalRows.map((row, index) => {
        const item = findMasterItemById(row.itemId);
        const itemValue = row.itemQuery || getPrItemPickerLabel(item);
        const itemError = row.errors?.item || '';
        const qtyError = row.errors?.qty || '';
        const unit = item ? (item.itemType === 'Set' ? 'set' : item.unit) : '—';
        return `
            <div class="modal-item-card ${itemError || qtyError ? 'has-error' : ''}">
                <div class="modal-item-header">
                    <div class="modal-item-title">Item #${index + 1}</div>
                    <button type="button" onclick="createRipple(event); removePrModalRow(${index})" class="ripple-btn modal-remove-btn" ${prModalRows.length === 1 ? 'disabled aria-disabled="true"' : ''}>Remove</button>
                </div>
                <div class="modal-item-grid pr-modal-item-grid">
                    <div class="field-group">
                        <label class="field-title" for="pr-modal-item-${index}">Item <span class="required-mark">*</span></label>
                        <input id="pr-modal-item-${index}" type="search" list="pr-modal-item-options" class="modal-input ${itemError ? 'modal-input-error' : ''}" value="${escapeHtml(itemValue)}" placeholder="Search by SKU or item name" autocomplete="off" oninput="updatePrModalItem(${index}, this.value)" onchange="updatePrModalItem(${index}, this.value)">
                        <div id="pr-modal-item-error-${index}" class="modal-error-text ${itemError ? '' : 'hidden'}">${escapeHtml(itemError)}</div>
                    </div>
                    <div class="field-group">
                        <label class="field-title" for="pr-modal-qty-${index}">Requested Qty <span class="required-mark">*</span></label>
                        <input id="pr-modal-qty-${index}" type="number" min="1" step="1" inputmode="numeric" class="modal-input number-control ${qtyError ? 'modal-input-error' : ''}" value="${escapeHtml(row.qty)}" placeholder="Enter qty" oninput="updatePrModalQty(${index}, this.value)">
                        <div id="pr-modal-qty-error-${index}" class="modal-error-text ${qtyError ? '' : 'hidden'}">${escapeHtml(qtyError)}</div>
                    </div>
                    <div class="field-group">
                        <label class="field-title">Unit</label>
                        <div id="pr-modal-unit-${index}" class="modal-static-value">${escapeHtml(unit)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function buildPrLine(item, qty) {
    return {
        lineId: createEntityId('pr-line'),
        itemId: item.id,
        itemName: item.name,
        qty,
        unit: item.itemType === 'Set' ? 'set' : item.unit,
        itemType: item.itemType,
        partsPerSet: item.partsPerSet
    };
}

function submitPurchaseRequestModal() {
    const numberInput = document.getElementById('pr-modal-number-input');
    const prNumber = String(numberInput?.value || '').trim();
    let valid = true;

    setPrModalNumberError('');
    setPrModalGeneralError('');

    if (!prNumber) {
        setPrModalNumberError('Enter a PR number.');
        valid = false;
    } else if (prModalMode === 'create' && purchaseRequests.some(pr => pr.number.toLowerCase() === prNumber.toLowerCase())) {
        setPrModalNumberError('This PR number already exists. Use “Add items” from the PR list instead.');
        valid = false;
    }

    const selectedIds = new Set();
    prModalRows.forEach(row => {
        const item = findPrPickerItem(row.itemQuery) || findMasterItemById(row.itemId);
        const qtyText = String(row.qty || '').trim();
        const qty = Number(qtyText);
        row.itemId = item?.id || '';
        row.errors = {};
        if (!item) row.errors.item = 'Choose an item from the suggestions.';
        if (item && selectedIds.has(item.id)) row.errors.item = 'This item is already included above.';
        if (item) selectedIds.add(item.id);
        if (!/^\d+$/.test(qtyText) || !Number.isSafeInteger(qty) || qty <= 0) {
            row.errors.qty = 'Enter a whole number above 0.';
        }
        if (Object.keys(row.errors).length > 0) valid = false;
    });

    if (!valid) {
        renderPrModalRows();
        if (!prNumber || document.getElementById('pr-modal-number-error')?.textContent) {
            numberInput?.focus();
        } else {
            document.querySelector('#pr-modal-items-container .modal-input-error')?.focus();
        }
        return false;
    }

    const previousState = JSON.parse(JSON.stringify(purchaseRequests));
    let pr;
    if (prModalMode === 'append') {
        pr = purchaseRequests.find(request => request.id === prModalTargetId);
        if (!pr) {
            setPrModalGeneralError('This PR is no longer available. Close the form and try again.');
            return false;
        }
    } else {
        pr = {
            id: createEntityId('pr'),
            number: prNumber,
            createdAt: getCurrentFormattedDateTime(),
            status: 'open',
            items: []
        };
        purchaseRequests.unshift(pr);
    }

    prModalRows.forEach(row => {
        const item = findMasterItemById(row.itemId);
        const qty = Number(row.qty);
        const existingLine = pr.items.find(line => line.itemId === item.id);
        if (existingLine) existingLine.qty += qty;
        else pr.items.push(buildPrLine(item, qty));
    });

    if (!savePurchaseRequests()) {
        purchaseRequests = previousState;
        setPrModalGeneralError('The PR could not be saved in browser storage. Your entries are still available; please try again.');
        return false;
    }

    const itemCount = prModalRows.length;
    const message = prModalMode === 'append'
        ? `${itemCount} item${itemCount === 1 ? '' : 's'} added to ${pr.number}.`
        : `${pr.number} created with ${itemCount} item${itemCount === 1 ? '' : 's'}.`;
    closePurchaseRequestModal();
    renderSecondaryViews();
    renderInventory();
    showToast(message);
    return true;
}

// Kept as a small compatibility bridge for older integrations that submit one PR line.
function createPurchaseRequest() {
    if (prModalRows.length > 0) return submitPurchaseRequestModal();
    const prNumber = String(document.getElementById('pr-id-input')?.value || '').trim();
    const itemId = document.getElementById('pr-item-select')?.value || '';
    const qtyText = String(document.getElementById('pr-qty-input')?.value || '').trim();
    const item = findMasterItemById(itemId);
    const qty = Number(qtyText);
    if (!prNumber || !item || !/^\d+$/.test(qtyText) || qty <= 0) return false;
    if (purchaseRequests.some(pr => pr.number.toLowerCase() === prNumber.toLowerCase())) return false;
    purchaseRequests.unshift({
        id: createEntityId('pr'),
        number: prNumber,
        createdAt: getCurrentFormattedDateTime(),
        status: 'open',
        items: [buildPrLine(item, qty)]
    });
    return savePurchaseRequests();
}

function confirmRemovePurchaseRequest(prNumber) {
    const pr = purchaseRequests.find(request => request.number.toLowerCase() === String(prNumber).toLowerCase());
    if (!pr) return;
    const receivedCount = inventory.filter(item => item.prId === pr.id || (item.pr || '') === pr.number).length;
    if (receivedCount > 0) {
        showAlertModal(
            `This PR has ${receivedCount} stock received record${receivedCount === 1 ? '' : 's'}. Remove those stock received records first.`,
            'Cannot Remove PR'
        );
        return;
    }

    showConfirmDialog(
        'Remove Purchase Request',
        `Are you sure you want to remove PR "${pr.number}"?`,
        () => {
            expandedPrIds.delete(pr.id);
            purchaseRequests = purchaseRequests.filter(request => request.id !== pr.id);
            savePurchaseRequests();
            renderSecondaryViews();
            renderInventory();
        }
    );
}

function renderItemModalForm(item = null) {
    const container = document.getElementById('item-modal-form');
    if (!container) return;
    const nameValue = item ? item.name : '';
    const skuValue = item ? item.sku : '';
    const categoryValue = item ? item.category : 'Aluminum';
    const unitValue = item ? item.unit : 'pcs';
    const typeValue = item ? item.itemType : 'Single';
    const typeLabel = typeValue === 'Set' ? 'Set Item' : 'Single Item';
    const partsValue = item ? item.partsPerSet : 1;
    const categoryOptions = appData.categories
        .filter(category => category.isActive !== false)
        .map(category => ({ value: category.name, label: category.name }));
    const unitOptions = appData.units.map(unit => ({ value: unit, label: unit }));

    container.innerHTML = `
        <div class="field-group">
            <label class="field-title" for="item-name-input">Item Name <span class="required-mark">*</span></label>
            <input id="item-name-input" class="filter-control" value="${escapeHtml(nameValue)}" placeholder="Aluminum Frame">
        </div>
        <div class="field-group">
            <label class="field-title" for="item-sku-input">SKU / Item Code <span class="required-mark">*</span></label>
            <input id="item-sku-input" class="filter-control" value="${escapeHtml(skuValue)}" placeholder="AL-FR-001">
        </div>
        <div class="field-group">
            <label class="field-title" for="item-category-input">Category</label>
            ${renderCustomFormDropdown('item-category-input', categoryValue, categoryOptions, 'selectFormDropdown', 'Aluminum')}
        </div>
        <div class="field-group">
            <label class="field-title" for="item-unit-input">Unit</label>
            ${renderCustomFormDropdown('item-unit-input', unitValue, unitOptions, 'selectFormDropdown', 'pcs')}
        </div>
        <div class="field-group">
            <label class="field-title" for="item-type-input">Item Type</label>
            ${renderCustomFormDropdown('item-type-input', typeValue, [{ value: 'Single', label: 'Single Item' }, { value: 'Set', label: 'Set Item' }], 'selectItemTypeDropdown', typeLabel)}
        </div>
        <div id="item-parts-field" class="field-group parts-per-set-field hidden">
            <label class="field-title" for="item-parts-input">Parts Per Set</label>
            <input id="item-parts-input" type="number" min="1" class="filter-control" value="${escapeHtml(partsValue)}" placeholder="Enter parts">
            <div class="parts-set-note">Only if Set</div>
        </div>
    `;
    syncItemTypeFields();
}

function openItemModal(itemId = null) {
    closeItemActionMenus();
    editingItemId = itemId;
    const item = itemId ? masterItems.find(masterItem => masterItem.id === itemId) : null;
    renderItemModalForm(item);
    const title = document.querySelector('#item-modal .modal-title');
    const kicker = document.getElementById('item-modal-kicker');
    const submitText = document.querySelector('#item-modal-submit span');
    if (title) title.innerText = item ? 'Edit Item' : 'Create New Item';
    if (kicker) kicker.innerText = item ? 'Update master data used throughout procurement' : 'Add master data for procurement and receiving';
    if (submitText) submitText.innerText = item ? 'Save Changes' : 'Create Item';
    const modal = document.getElementById('item-modal');
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('flex');
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeItemModal() {
    const modal = document.getElementById('item-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        modal.classList.remove('flex');
        editingItemId = null;
    }, 300);
}

// Ripple Effect Click Transition
