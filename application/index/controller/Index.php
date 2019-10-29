<?php

namespace app\index\controller;

use app\common\controller\Frontend;

class Index extends Frontend
{

    protected $noNeedLogin = '*';
    protected $noNeedRight = '*';
    protected $layout = '';

    public function index()
    {
        return $this->view->fetch();
    }

    public  function brief(){
        return $this->view->fetch();
    }

    public  function contact(){
        return $this->view->fetch();
    }

    public  function expert(){
        return $this->view->fetch();
    }

    public  function expert_details(){
        return $this->view->fetch();
    }


    public  function hotel(){
        return $this->view->fetch();
    }

    public  function message(){
        return $this->view->fetch();
    }
    public  function metting(){
        return $this->view->fetch();
    }
    public  function notice(){
        return $this->view->fetch();
    }
    public  function question(){
        return $this->view->fetch();
    }
    public  function sign(){
        return $this->view->fetch();
    }
    public  function successful(){
        return $this->view->fetch();
    }
    public  function verify(){
        return $this->view->fetch();
    }
    public  function welcome(){
        return $this->view->fetch();
    }

}
