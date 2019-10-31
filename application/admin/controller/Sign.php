<?php

namespace app\admin\controller;

use app\common\controller\Backend;
use app\common\library\Sms;
use think\Db;
/**
 * 参会报名
 *
 * @icon fa fa-circle-o
 */
class Sign extends Backend
{
    
    /**
     * Sign模型对象
     * @var \app\admin\model\Sign
     */
    protected $model = null;

    public function _initialize()
    {
        parent::_initialize();
        $this->model = new \app\admin\model\Sign;
        $this->view->assign("typeList", $this->model->getTypeList());
        $this->view->assign("isjoinList", $this->model->getIsjoinList());
        $this->view->assign("sexList", $this->model->getSexList());
        $this->view->assign("approveList", $this->model->getApproveList());
    }
    
    /**
     * 默认生成的控制器所继承的父类中有index/add/edit/del/multi五个基础方法、destroy/restore/recyclebin三个回收站方法
     * 因此在当前控制器中可不用编写增删改查的代码,除非需要自己控制这部分逻辑
     * 需要将application/admin/library/traits/Backend.php中对应的方法复制到当前控制器,然后进行修改
     */
    /**
     * 编辑
     */
    public function edit($ids = null)
    {
        $row = $this->model->get($ids);
        if (!$row) {
            $this->error(__('No Results were found'));
        }
        $adminIds = $this->getDataLimitAdminIds();
        if (is_array($adminIds)) {
            if (!in_array($row[$this->dataLimitField], $adminIds)) {
                $this->error(__('You have no permission'));
            }
        }
        if ($this->request->isPost()) {
            $params = $this->request->post("row/a");
            if ($params) {
                $params = $this->preExcludeFields($params);
                $result = false;
                Db::startTrans();
                try {
                    //是否采用模型验证
                    if ($this->modelValidate) {
                        $name = str_replace("\\model\\", "\\validate\\", get_class($this->model));
                        $validate = is_bool($this->modelValidate) ? ($this->modelSceneValidate ? $name . '.edit' : $name) : $this->modelValidate;
                        $row->validateFailException(true)->validate($validate);
                        var_dump($params['approve']);
                        if($params['approve']=="通过"){
                            dump("1111");
                            $date='2019年11月29日15：00-20：00';
                            $address="深圳市罗湖区香格里拉大酒店";
                            $result=Sms::notice($params['mobile'],['$date'=>$date], ['address'=>$address], 'SMS_176537851');
                        }
                    }
                    $result = $row->allowField(true)->save($params);
                    Db::commit();
                } catch (ValidateException $e) {
                    Db::rollback();
                    $this->error($e->getMessage());
                } catch (PDOException $e) {
                    Db::rollback();
                    $this->error($e->getMessage());
                } catch (Exception $e) {
                    Db::rollback();
                    $this->error($e->getMessage());
                }
                if ($result !== false) {
                    $this->success();
                } else {
                    $this->error(__('No rows were updated'));
                }
            }
            $this->error(__('Parameter %s can not be empty', ''));

        }
        $this->view->assign("row", $row);
        return $this->view->fetch();
    }
    

}
