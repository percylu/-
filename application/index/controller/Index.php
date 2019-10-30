<?php

namespace app\index\controller;

use app\common\controller\Frontend;
use app\common\library\Sms;
use think\Db;
class Index extends Frontend
{

    protected $noNeedLogin = '*';
    protected $noNeedRight = '*';
    protected $layout = '';

    public function index()
    {
        return $this->view->fetch();
    }

    public function brief()
    {
        return $this->view->fetch();
    }

    public function contact()
    {
        return $this->view->fetch();
    }

    public function expert()
    {
        $expert=Db::table('zb_expert')->field('id,name,title,image,introduce')->order('order')->select();
        $this->assign('expert',$expert);
        return $this->view->fetch();
    }

    public function expert_details()
    {
        $id=input("get.id");
        $expert=Db::table('zb_expert')->where('id',$id)->find();
        $this->assign('expert',$expert);
        return $this->view->fetch();
    }


    public function hotel()
    {
        return $this->view->fetch();
    }

    public function message()
    {
        return $this->view->fetch();
    }

    public function metting()
    {
        return $this->view->fetch();
    }

    public function notice()
    {
        return $this->view->fetch();
    }

    public function question()
    {
        return $this->view->fetch();
    }

    public function sign()
    {
        return $this->view->fetch();
    }

    public function signed(){
        $data['type']=input('post.type');
        $data['isjoin']=input('post.exhibitor');
        $data['company']=input('post.company');
        $data['identification']=input('post.identification');
        $data['address']=input('post.address');
        $data['name']=input('post.name');
        $data['sex']=input('post.gender');
        $data['department']=input('post.department');
        $data['position']=input('post.position');
        $data['mobile']=input('post.phone');
        $data['personid']=input('post.personid');
        $time=time();
        $data['createtime']=$time;
        $result= Db::table('zb_sign')->insert($data);

        if($result){
            //设置成功后跳转页面的地址，默认的返回页面是$_SERVER['HTTP_REFERER']
            return $this->success('报名已提交', 'Index/index');
        } else {
            //错误页面的默认跳转页面是返回前一页，通常不需要设置
            return $this->error('新增失败');
        }

    }

    public function successful()
    {
        return $this->view->fetch();
    }

    public function verify()
    {
        return $this->view->fetch();
    }

    public function welcome()
    {
        return $this->view->fetch();
    }

    public function getauthmsg()
    {
        $phone = input('get.phone');
        $code=$this->generate_code(6);
        $result=Sms::send($phone, $code, 'auth');
        if($result){
            $data['status']=0;
            $data['data']=$code;
        }else{
            $data['status']=-1;
            $data['msg']="获取验证码失败";
        }

        return $data;
    }

    private function generate_code($length = 6) {
        return rand(pow(10,($length-1)), pow(10,$length)-1);
    }

}
