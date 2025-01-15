package com.example.controller;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.thread.ThreadUtil;
import com.example.common.Result;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;

/**
 * 文件接口
 */
@RestController
@RequestMapping("/files")
public class FileController {

    private static final String filePath = System.getProperty("user.dir") + "/springboot/files/";

    @Value("${server.port:20000}")
    private String port;

    @Value("${ip:localhost}")
    private String ip;

    /**
     * 文件上传
     */
    @PostMapping("/upload")
    public Result upload(MultipartFile file) {
        String flag;
        synchronized (FileController.class) {
            flag = System.currentTimeMillis() + "";
            ThreadUtil.sleep(1L);
        }
        String fileName = file.getOriginalFilename();
        try {
            if (!FileUtil.isDirectory(filePath)) {
                FileUtil.mkdir(filePath);
            }
            FileUtil.writeBytes(file.getBytes(), filePath + flag + "-" + fileName);
            System.out.println(fileName + "--上传成功");

        } catch (Exception e) {
            System.err.println(fileName + "--文件上传失败");
        }
        String http = "http://" + ip + ":" + port + "/files/";
        return Result.success(http + flag + "-" + fileName);
    }


    /**
     * 获取文件
     *
     * @param flag
     * @param response
     */
    @GetMapping("/{flag}")
    public void avatarPath(@PathVariable String flag, HttpServletResponse response)  {
        try {
            // 根据文件的唯一标识码获取文件
            File file = new File(filePath + flag);

            response.setHeader("Accept-Ranges", "bytes");
            response.setContentLength(Math.toIntExact(file.length()));

            // 设置输出流的格式,告诉浏览器输出内容为流
            response.setContentType("application/octet-stream");
            // 设置文件名
            response.addHeader("Content-Disposition", "attachment;filename=" + URLEncoder.encode(file.getName(), "UTF-8"));

            ServletOutputStream os = response.getOutputStream();
            // 读取文件的字节流
            os.write(FileUtil.readBytes(file));
            os.flush();
            os.close();
        }catch (IOException e){

        }

    }

    /**
     * 删除文件
     *
     * @param flag
     */
    @DeleteMapping("/{flag}")
    public void delFile(@PathVariable String flag) {
        FileUtil.del(filePath + flag);
        System.out.println("删除文件" + flag + "成功");
    }


}
