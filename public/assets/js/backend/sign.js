define(['jquery', 'bootstrap', 'backend', 'table', 'form'], function ($, undefined, Backend, Table, Form) {

    var Controller = {
        index: function () {
            // 初始化表格参数配置
            Table.api.init({
                extend: {
                    index_url: 'sign/index' + location.search,
                    add_url: 'sign/add',
                    edit_url: 'sign/edit',
                    del_url: 'sign/del',
                    multi_url: 'sign/multi',
                    table: 'sign',
                }
            });

            var table = $("#table");

            // 初始化表格
            table.bootstrapTable({
                url: $.fn.bootstrapTable.defaults.extend.index_url,
                pk: 'id',
                sortName: 'id',
                columns: [
                    [
                        {checkbox: true},
                        {field: 'id', title: __('Id')},
                        {field: 'type', title: __('Type'), searchList: {"企业参展":__('企业参展'),"个人参展":__('个人参展')}, formatter: Table.api.formatter.normal},
                        {field: 'isjoin', title: __('Isjoin'), searchList: {"是":__('是'),"否":__('否')}, formatter: Table.api.formatter.normal},
                        {field: 'company', title: __('Company')},
                        {field: 'identification', title: __('Identification')},
                        {field: 'address', title: __('Address')},
                        {field: 'name', title: __('Name')},
                        {field: 'sex', title: __('Sex'), searchList: {"女":__('女'),"男":__('男')}, formatter: Table.api.formatter.normal},
                        {field: 'department', title: __('Department')},
                        {field: 'position', title: __('Position')},
                        {field: 'mobile', title: __('Mobile')},
                        {field: 'personid', title: __('Personid')},
                        {field: 'approve', title: __('Approve'), searchList: {"不通过":__('不通过'),"通过":__('通过')}, formatter: Table.api.formatter.normal},
                        {field: 'createtime', title: __('Createtime'), operate:'RANGE', addclass:'datetimerange', formatter: Table.api.formatter.datetime},
                        {field: 'updatetime', title: __('Updatetime'), operate:'RANGE', addclass:'datetimerange', formatter: Table.api.formatter.datetime},
                        {field: 'operate', title: __('Operate'), table: table, events: Table.api.events.operate, formatter: Table.api.formatter.operate}
                    ]
                ]
            });

            // 为表格绑定事件
            Table.api.bindevent(table);
        },
        add: function () {
            Controller.api.bindevent();
        },
        edit: function () {
            Controller.api.bindevent();
        },
        api: {
            bindevent: function () {
                Form.api.bindevent($("form[role=form]"));
            }
        }
    };
    return Controller;
});