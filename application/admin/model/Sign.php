<?php

namespace app\admin\model;

use think\Model;


class Sign extends Model
{

    

    

    // 表名
    protected $name = 'sign';
    
    // 自动写入时间戳字段
    protected $autoWriteTimestamp = 'int';

    // 定义时间戳字段名
    protected $createTime = 'createtime';
    protected $updateTime = 'updatetime';
    protected $deleteTime = false;

    // 追加属性
    protected $append = [
        'type_text',
        'isjoin_text',
        'sex_text',
        'approve_text'
    ];
    

    
    public function getTypeList()
    {
        return ['企业参展' => __('企业参展'), '个人参展' => __('个人参展')];
    }

    public function getIsjoinList()
    {
        return ['是' => __('是'), '否' => __('否')];
    }

    public function getSexList()
    {
        return ['女' => __('女'), '男' => __('男')];
    }

    public function getApproveList()
    {
        return ['不通过' => __('不通过'), '通过' => __('通过')];
    }


    public function getTypeTextAttr($value, $data)
    {
        $value = $value ? $value : (isset($data['type']) ? $data['type'] : '');
        $list = $this->getTypeList();
        return isset($list[$value]) ? $list[$value] : '';
    }


    public function getIsjoinTextAttr($value, $data)
    {
        $value = $value ? $value : (isset($data['isjoin']) ? $data['isjoin'] : '');
        $list = $this->getIsjoinList();
        return isset($list[$value]) ? $list[$value] : '';
    }


    public function getSexTextAttr($value, $data)
    {
        $value = $value ? $value : (isset($data['sex']) ? $data['sex'] : '');
        $list = $this->getSexList();
        return isset($list[$value]) ? $list[$value] : '';
    }


    public function getApproveTextAttr($value, $data)
    {
        $value = $value ? $value : (isset($data['approve']) ? $data['approve'] : '');
        $list = $this->getApproveList();
        return isset($list[$value]) ? $list[$value] : '';
    }




}
