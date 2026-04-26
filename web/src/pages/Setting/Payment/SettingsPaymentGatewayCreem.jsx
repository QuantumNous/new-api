/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import React, { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Switch,
  useOverlayState,
} from '@heroui/react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';
const selectClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

function Field({ label, value, onChange, placeholder, type = 'text', helper, disabled }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <Input
        type={type}
        value={value === '' || value == null ? '' : String(value)}
        onChange={(event) => {
          const v = event.target.value;
          if (type === 'number') {
            onChange(v === '' ? '' : Number(v));
          } else {
            onChange(v);
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        disabled={disabled}
        className={inputClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

export default function SettingsPaymentGatewayCreem(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('Creem 设置');

  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    CreemApiKey: '',
    CreemWebhookSecret: '',
    CreemProducts: '[]',
    CreemTestMode: false,
  });
  const [products, setProducts] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    productId: '',
    price: 0,
    quota: 0,
    currency: 'USD',
  });

  const setField = (key) => (value) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!props.options) return;
    const next = {
      CreemApiKey: props.options.CreemApiKey || '',
      CreemWebhookSecret: props.options.CreemWebhookSecret || '',
      CreemProducts: props.options.CreemProducts || '[]',
      CreemTestMode: props.options.CreemTestMode === 'true',
    };
    setInputs(next);
    try {
      const parsedProducts = JSON.parse(next.CreemProducts);
      setProducts(Array.isArray(parsedProducts) ? parsedProducts : []);
    } catch (e) {
      setProducts([]);
    }
  }, [props.options]);

  const submit = async () => {
    setLoading(true);
    try {
      const options = [];
      if (inputs.CreemApiKey) {
        options.push({ key: 'CreemApiKey', value: inputs.CreemApiKey });
      }
      if (inputs.CreemWebhookSecret) {
        options.push({
          key: 'CreemWebhookSecret',
          value: inputs.CreemWebhookSecret,
        });
      }
      options.push({
        key: 'CreemTestMode',
        value: inputs.CreemTestMode ? 'true' : 'false',
      });
      options.push({ key: 'CreemProducts', value: JSON.stringify(products) });

      const requestQueue = options.map((opt) =>
        API.put('/api/option/', { key: opt.key, value: opt.value }),
      );
      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data?.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data?.message));
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    } finally {
      setLoading(false);
    }
  };

  const openProductModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({ ...product });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        productId: '',
        price: 0,
        quota: 0,
        currency: 'USD',
      });
    }
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm({
      name: '',
      productId: '',
      price: 0,
      quota: 0,
      currency: 'USD',
    });
  };

  const saveProduct = () => {
    if (
      !productForm.name ||
      !productForm.productId ||
      productForm.price <= 0 ||
      productForm.quota <= 0 ||
      !productForm.currency
    ) {
      showError(t('请填写完整的产品信息'));
      return;
    }

    let newProducts = [...products];
    if (editingProduct) {
      const index = newProducts.findIndex(
        (p) => p.productId === editingProduct.productId,
      );
      if (index !== -1) {
        newProducts[index] = { ...productForm };
      }
    } else {
      if (newProducts.find((p) => p.productId === productForm.productId)) {
        showError(t('产品ID已存在'));
        return;
      }
      newProducts.push({ ...productForm });
    }

    setProducts(newProducts);
    closeProductModal();
  };

  const deleteProduct = (productId) => {
    const newProducts = products.filter((p) => p.productId !== productId);
    setProducts(newProducts);
  };

  const productModalState = useOverlayState({
    isOpen: showProductModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) closeProductModal();
    },
  });

  return (
    <div className='p-6 space-y-6'>
      {sectionTitle ? (
        <div className='text-base font-semibold text-foreground'>
          {sectionTitle}
        </div>
      ) : null}

      <div className='flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200'>
        <BookOpen size={16} className='mt-0.5 shrink-0' />
        <div className='space-y-1'>
          <div>
            {t('Creem 介绍')}
            <a
              href='https://creem.io'
              target='_blank'
              rel='noreferrer'
              className='ml-1 text-primary underline'
            >
              Creem Official Site
            </a>
          </div>
          <div>{t('Creem Setting Tips')}</div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Field
          label={t('API 密钥')}
          value={inputs.CreemApiKey}
          onChange={setField('CreemApiKey')}
          placeholder={t('Creem API 密钥，敏感信息不显示')}
          type='password'
        />
        <Field
          label={t('Webhook 签名密钥')}
          value={inputs.CreemWebhookSecret}
          onChange={setField('CreemWebhookSecret')}
          placeholder={t(
            '用于验证回调 new-api 的 webhook 请求的密钥，敏感信息不显示',
          )}
          type='password'
        />
        <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
          <div className='min-w-0 flex-1'>
            <div className='text-sm font-medium text-foreground'>
              {t('沙盒模式')}
            </div>
            <div className='mt-1 text-xs leading-snug text-muted'>
              {t('启用后将使用 Creem Test Mode')}
            </div>
          </div>
          <Switch
            isSelected={!!inputs.CreemTestMode}
            onChange={setField('CreemTestMode')}
            aria-label={t('沙盒模式')}
            size='sm'
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </label>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <div className='text-sm font-semibold text-foreground'>
            {t('产品配置')}
          </div>
          <Button
            color='primary'
            size='sm'
            startContent={<Plus size={14} />}
            onPress={() => openProductModal()}
          >
            {t('添加产品')}
          </Button>
        </div>

        {products.length === 0 ? (
          <div className='rounded-xl border border-dashed border-[color:var(--app-border)] py-10 text-center text-sm text-muted'>
            {t('暂无产品配置')}
          </div>
        ) : (
          <div className='overflow-hidden rounded-xl border border-[color:var(--app-border)]'>
            <table className='w-full text-sm'>
              <thead className='bg-[color:var(--app-background)] text-xs uppercase text-muted'>
                <tr>
                  <th className='px-3 py-2 text-left font-semibold'>
                    {t('产品名称')}
                  </th>
                  <th className='px-3 py-2 text-left font-semibold'>
                    {t('产品ID')}
                  </th>
                  <th className='px-3 py-2 text-left font-semibold'>
                    {t('展示价格')}
                  </th>
                  <th className='px-3 py-2 text-left font-semibold'>
                    {t('充值额度')}
                  </th>
                  <th className='w-32 px-3 py-2 text-right font-semibold'>
                    {t('操作')}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-[color:var(--app-border)]'>
                {products.map((product) => (
                  <tr key={product.productId}>
                    <td className='px-3 py-2 font-medium text-foreground'>
                      {product.name}
                    </td>
                    <td className='px-3 py-2 text-xs text-muted'>
                      {product.productId}
                    </td>
                    <td className='px-3 py-2 text-foreground'>
                      {product.currency === 'EUR' ? '€' : '$'}
                      {product.price}
                    </td>
                    <td className='px-3 py-2 text-foreground'>
                      {product.quota}
                    </td>
                    <td className='px-3 py-2 text-right'>
                      <div className='inline-flex items-center gap-1'>
                        <Button
                          variant='light'
                          size='sm'
                          onPress={() => openProductModal(product)}
                        >
                          {t('编辑')}
                        </Button>
                        <Button
                          isIconOnly
                          variant='light'
                          color='danger'
                          size='sm'
                          aria-label={t('删除')}
                          onPress={() => deleteProduct(product.productId)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={submit}
          isPending={loading}
          className='min-w-[140px]'
        >
          {t('更新 Creem 设置')}
        </Button>
      </div>

      <Modal state={productModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='sm' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                {editingProduct ? t('编辑产品') : t('添加产品')}
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('产品名称')}
                  </div>
                  <Input
                    type='text'
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        name: event.target.value,
                      })
                    }
                    placeholder={t('例如：基础套餐')}
                    aria-label={t('产品名称')}
                    className={inputClass}
                  />
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('产品ID')}
                  </div>
                  <Input
                    type='text'
                    value={productForm.productId}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        productId: event.target.value,
                      })
                    }
                    placeholder={t('例如：prod_6I8rBerHpPxyoiU9WK4kot')}
                    disabled={!!editingProduct}
                    aria-label={t('产品ID')}
                    className={inputClass}
                  />
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('货币')}
                  </div>
                  <select
                    value={productForm.currency}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        currency: event.target.value,
                      })
                    }
                    aria-label={t('货币')}
                    className={selectClass}
                  >
                    <option value='USD'>{t('USD (美元)')}</option>
                    <option value='EUR'>{t('EUR (欧元)')}</option>
                  </select>
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('价格')} (
                    {productForm.currency === 'EUR' ? t('欧元') : t('美元')})
                  </div>
                  <Input
                    type='number'
                    value={
                      productForm.price === '' || productForm.price == null
                        ? ''
                        : String(productForm.price)
                    }
                    onChange={(event) => {
                      const v = event.target.value;
                      setProductForm({
                        ...productForm,
                        price: v === '' ? 0 : Number(v),
                      });
                    }}
                    placeholder={t('例如：4.99')}
                    min={0.01}
                    step={0.01}
                    aria-label={t('价格')}
                    className={inputClass}
                  />
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('充值额度')}
                  </div>
                  <Input
                    type='number'
                    value={
                      productForm.quota === '' || productForm.quota == null
                        ? ''
                        : String(productForm.quota)
                    }
                    onChange={(event) => {
                      const v = event.target.value;
                      setProductForm({
                        ...productForm,
                        quota: v === '' ? 0 : Number(v),
                      });
                    }}
                    placeholder={t('例如：100000')}
                    min={1}
                    step={1}
                    aria-label={t('充值额度')}
                    className={inputClass}
                  />
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button variant='light' onPress={closeProductModal}>
                  {t('取消')}
                </Button>
                <Button color='primary' onPress={saveProduct}>
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
