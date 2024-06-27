package src.main.java;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import javax.sql.DataSource; 

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@SpringBootApplication
@RestController
public class Application {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @GetMapping("/")
    public ResponseEntity<Resource> getIndex() throws IOException {
        System.out.println("? -> /");
        Path path = Paths.get("index.html");
        Resource resource = new UrlResource(path.toUri());
        return ResponseEntity.ok().body(resource);
    }

    @GetMapping("/main.css")
    public ResponseEntity<Resource> getMainCSS() throws IOException {
        Path path = Paths.get("main.css");
        Resource resource = new UrlResource(path.toUri());
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("text/css"))
            .body(resource);
    }

    @GetMapping("/app.js")
    public ResponseEntity<Resource> getAppJS() throws IOException {
        Path path = Paths.get("app.js");
        Resource resource = new UrlResource(path.toUri());
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("application/javascript"))
            .body(resource);
    }

    @GetMapping("/three")
    public ResponseEntity<Resource> getThreeModule() throws IOException {
        Path path = Paths.get("node_modules/three/build/three.module.js");
        Resource resource = new UrlResource(path.toUri());
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("application/javascript"))
            .body(resource);
    }

    @GetMapping("/image-tags")
    public List<TagCount> getImageTags() {
        String query = "SELECT DISTINCT tag AS name, COUNT(tag) AS countOf FROM images GROUP BY tag ORDER BY tag ASC";
        return jdbcTemplate.query(query, BeanPropertyRowMapper.newInstance(TagCount.class));
    }

    @GetMapping("/images")
    public List<String> getImages(@RequestParam String tag) {
        String query = "SELECT id FROM images WHERE tag IS NOT NULL AND tag = ?";
        return jdbcTemplate.queryForList(query, String.class, tag);
    }

    @GetMapping("/image")
    public ResponseEntity<byte[]> getImage(@RequestParam String id) {
        String query = "SELECT image FROM images WHERE id = ?";
        byte[] image = jdbcTemplate.queryForObject(query, byte[].class, id);
        return ResponseEntity.ok().body(image);
    }

    @PostMapping("/save")
    public void saveToFile(@RequestBody String body) throws IOException {
        // Implement saving to file logic
    }

    @GetMapping("/load")
    public String loadFromFile() throws IOException {
        // Implement loading from file logic
        return null;
    }

    // POJO for image tag count
    public static class TagCount {
        private String name;
        private Long countOf;

        // Getters and setters
        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Long getCountOf() {
            return countOf;
        }

        public void setCountOf(Long countOf) {
            this.countOf = countOf;
        }
    }
}

