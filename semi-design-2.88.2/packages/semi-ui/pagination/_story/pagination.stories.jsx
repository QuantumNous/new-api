import React, { useState } from 'react';

// import 'normalize.css';
import { Button } from '../../index';
import Pagination from '../index';

export default {
  title: 'Pagination'
}

export const PaginationSmall = () => (
  <>
    <Pagination total={90} size="small"></Pagination>
    <Pagination total={200000000} size="small" hoverShowPageSelect></Pagination>
  </>
);

PaginationSmall.story = {
  name: 'Pagination small',
};

export const PaginationDefault = () => (
  <div>
    <Pagination total={1}></Pagination>
    <Pagination total={0}></Pagination>
    <Pagination total={9}></Pagination>
    <Pagination total={30}></Pagination>
    <Pagination total={80}></Pagination>
    <Pagination total={200}></Pagination>
    <Pagination total={80} pageSize={30}></Pagination>
    <Pagination total={1000000000}></Pagination>
  </div>
);

PaginationDefault.story = {
  name: 'Pagination default',
};

export const PaginationHideOnSinglePage = () => (
  <div>
    <Pagination total={1} hideOnSinglePage></Pagination>
    <Pagination total={0} hideOnSinglePage></Pagination>
    <Pagination total={9} hideOnSinglePage></Pagination>
    <Pagination total={30} hideOnSinglePage></Pagination>
  </div>
);

PaginationHideOnSinglePage.story = {
  name: 'Pagination hideOnSinglePage',
};

export const DefaultCurrentPageDemo = () => (
  <div>
    <Pagination total={20000} defaultCurrentPage={2}></Pagination>
  </div>
);

DefaultCurrentPageDemo.story = {
  name: 'Pagination 指定当前页',
};

const ControlPage = () => {
  const [page, setPage] = useState(3);
  function onPageChange(currentPage) {
    setPage(currentPage);
  }
  return (
    <div>
      <Pagination total={200} currentPage={page} onPageChange={onPageChange}></Pagination>
    </div>
  );
};
export const ControlledPageDemo = () => <ControlPage />;

ControlledPageDemo.story = {
  name: 'Pagination 页码受控',
};

export const PaginationShowPageSizeChanger = () => (
  <div>
    <Pagination total={100} showSizeChanger showTotal></Pagination>
    <Pagination total={200}></Pagination>
    <Pagination
      total={300}
      showSizeChanger
      pageSizeOpts={[10, 20, 50, 200]}
      onPageChange={(page, pageSize) => console.log(`pageChange:${page},pageSize:${pageSize}`)}
      onPageSizeChange={pageSize => console.log(`pageSizeChange${pageSize}`)}
    ></Pagination>
    <Pagination total={300} showSizeChanger></Pagination>
  </div>
);

PaginationShowPageSizeChanger.story = {
  name: 'Pagination showPageSizeChanger',
};

export const PaginationPageSizeOpts = () => (
  <div>
    <Pagination total={80} showSizeChanger></Pagination>
    <Pagination total={200}></Pagination>

    <Pagination total={300} showSizeChanger pageSizeOpts={[50, 80, 90, 200]}></Pagination>
  </div>
);

PaginationPageSizeOpts.story = {
  name: 'Pagination pageSizeOpts',
};

export const PaginationShowQuickJumper = () => (
  <div>
    <Pagination total={1} showSizeChanger showQuickJumper></Pagination>
    <Pagination total={80} showSizeChanger showQuickJumper></Pagination>
    <Pagination total={200} showQuickJumper></Pagination>
    <Pagination
      total={300}
      showSizeChanger
      pageSizeOpts={[50, 80, 90, 200]}
      showQuickJumper
    ></Pagination>
  </div>
);

PaginationShowQuickJumper.story = {
  name: 'Pagination showQuickJumper',
};

const DynamicPageSize = () => {
  const [pageSize, setPageSize] = useState(10);
  function changePageSize() {
    let map = {
      10: 40,
      40: 100,
      100: 20,
      100: 10,
    };
    setPageSize(map[pageSize]);
  }
  return (
    <>
      <Pagination total={200} showSizeChanger pageSize={pageSize}></Pagination>
      <br />
      <Button onClick={changePageSize}>change</Button>
    </>
  );
};

export const PaginationDynamicUpdatePageSize = () => <DynamicPageSize />;

PaginationDynamicUpdatePageSize.story = {
  name: 'Pagination dynamic update pageSize',
};


export const HideOnSingePageAndShowChanger = () => {
  return (
    <Pagination total={10} hideOnSinglePage showSizeChanger style={{ marginBottom: 12 }}></Pagination>
  )
}

HideOnSingePageAndShowChanger.story = {
  name: 'hideOnSingelePage & showSizeChanger at same time',
};

export const DisabledPagination = () => {
  return (
    <div>
      <Pagination total={100} disabled style={{ marginBottom: 12 }} size='small'></Pagination>
      <Pagination total={100} disabled style={{ marginBottom: 12 }} showQuickJumper size='small'></Pagination>
      <Pagination total={100} disabled style={{ marginBottom: 12 }} size='small' hoverShowPageSelect></Pagination>
      <Pagination total={100} disabled style={{ marginBottom: 12 }} showQuickJumper></Pagination>
      <Pagination total={100} disabled style={{ marginBottom: 12 }} showSizeChanger></Pagination>
      <Pagination total={100} disabled style={{ marginBottom: 12 }} showTotal></Pagination>
      <Pagination total={100} disabled style={{ marginBottom: 12 }} showTotal showSizeChanger showQuickJumper></Pagination>
    </div>
  )
}
